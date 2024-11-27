import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';
import { useGlobalDialog } from "@/stores/global-dialog";
import { useFranchiseeStore } from "@/stores/franchisees";
import { usePricingRules } from "@/stores/pricing-rules";
import { useUserStore } from "@/stores/user";
import { utils, writeFile } from "xlsx";
import { getSessionStatusFromAdjustmentRecord, waitMilliseconds } from "@/utils/utils.mjs";
import { readFromDataCells } from "../../../netsuite-shared-modules/index.mjs";
import { usePriceAdjustment } from "@/stores/price-adjustment";

const state = {
    all: [],
};

const getters = {

};

const actions = {
    async init() {
        if (!top.location.href.includes('app.netsuite')) return;

        useGlobalDialog().displayProgress('', 'Retrieving all franchisees...');

        await fetchData(this);

        await useGlobalDialog().close(500, 'Complete');
    },
    async toggleActiveStatusOfAdjustmentRecord(adjustmentRecord) {
        const stateSwitch = adjustmentRecord['custrecord_1302_opt_out_reason'] ? 1 : 0;

        const lookupTable = {
            0: {
                cfmTitle: `Opt out session`,
                cfmMsg: `Would you like to opt out of franchisee ${adjustmentRecord['custrecord_1302_franchisee_text']}' session?`,
                prgMsg: `Opting out of franchisee ${adjustmentRecord['custrecord_1302_franchisee_text']}' session...`,
                optOutReason: `Opted out by ${useUserStore().name}`
            },
            1: {
                cfmTitle: `Reinstate session`,
                cfmMsg: `Would you like to reinstate franchisee ${adjustmentRecord['custrecord_1302_franchisee_text']}' session?`,
                prgMsg: `Reinstating franchisee ${adjustmentRecord['custrecord_1302_franchisee_text']}' session...`,
                optOutReason: ''
            },
        }

        const res = await useGlobalDialog().displayConfirmation(lookupTable[stateSwitch].cfmTitle, lookupTable[stateSwitch].cfmMsg)

        if (!res) return;

        useGlobalDialog().displayProgress('', lookupTable[stateSwitch].prgMsg);

        await http.post('saveOrCreatePriceAdjustmentRecord', {
            priceAdjustmentRecordId: adjustmentRecord['internalid'],
            priceAdjustmentData: {
                custrecord_1302_opt_out_reason: lookupTable[stateSwitch].optOutReason
            }});

        await fetchData(this);

        await useGlobalDialog().close(500, 'Complete');
    },
    async exportFranchiseeSessionStatus() {
        const res = await useGlobalDialog().displayConfirmation('Exporting Data',
            'This will export a report on the latest session status of franchisees. Proceed?');

        if (!res) return;

        useGlobalDialog().displayProgress('', 'Retrieving Data from Netsuite...');
        await fetchData(this);

        useGlobalDialog().displayProgress('', 'Generating Spreadsheet File...');
        const excludeList = [0];

        let excelRows = this.all.map(franchisee => {
            if (/^old /gi.test(franchisee['companyname'])) return;
            if (/^test/gi.test(franchisee['companyname'])) return;
            if (excludeList.includes(parseInt(franchisee['internalid']))) return;

            return {
                franchiseeId: franchisee['internalid'],
                franchiseeName: franchisee['companyname'],
                sessionStatus: getSessionStatusFromAdjustmentRecord(franchisee['adjustmentRecord']).status
            }
        }).filter(item => !!item);

        const headers = ['Franchisee ID', 'Franchisee Name', 'Session Status'];
        const workbook = utils.book_new();
        const worksheet = utils.json_to_sheet(excelRows);

        utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });
        utils.sheet_add_json(worksheet, excelRows, { origin: 'A2', skipHeader: true });
        utils.book_append_sheet(workbook, worksheet, "Report");

        writeFile(workbook, "franchisee_session_status_report.xlsx", { compression: true });

        await useGlobalDialog().close(2000, 'Complete! Your spreadsheet will be downloaded shortly.')
    },
    async exportAllFranchiseeAdjustmentData() {
        const res = await useGlobalDialog().displayConfirmation('Exporting Data',
            'This will export a report on only services that have received confirmed and actionable adjustment. Proceed?');

        if (!res) return;

        useGlobalDialog().displayProgress('', 'Retrieving Data from Netsuite...');
        await fetchData(this);

        useGlobalDialog().displayProgress('', 'Generating Spreadsheet File...');
        let excelRows = [];

        this.all.forEach(franchiseeData => {
            const adjustmentRecord = franchiseeData['adjustmentRecord'];
            if (adjustmentRecord && !adjustmentRecord?.['custrecord_1302_opt_out_reason']) {
                const adjustmentData = readFromDataCells(adjustmentRecord, 'custrecord_1302_data_') || [];

                adjustmentData.filter(item => item['confirmed'] && item['adjustment'] !== 0).forEach(adjustedService => {
                    excelRows.push({
                        franchiseeId: adjustedService['custrecord_service_franchisee'],
                        franchiseeName: adjustedService['custrecord_service_franchisee_text'],
                        customerId: adjustedService['CUSTRECORD_SERVICE_CUSTOMER.entityid'],
                        customerName: adjustedService['CUSTRECORD_SERVICE_CUSTOMER.companyname'],
                        serviceId: adjustedService['internalid'],
                        service: adjustedService['custrecord_service_text'],
                        currentPrice: parseFloat(adjustedService['custrecord_service_price']),
                        adjustment: parseFloat(adjustedService['adjustment']),
                        newPrice: parseFloat(adjustedService['custrecord_service_price']) + parseFloat(adjustedService['adjustment']),
                    })
                })
            }
        })

        const headers = ['Franchisee ID', 'Franchisee Name', 'Customer ID', 'Customer Name', 'Service ID', 'Service', 'Current Price', 'Adjustment', 'New Price'];
        const workbook = utils.book_new();
        const worksheet = utils.json_to_sheet(excelRows);

        utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });
        utils.sheet_add_json(worksheet, excelRows, { origin: 'A2', skipHeader: true });
        utils.book_append_sheet(workbook, worksheet, "Report");

        writeFile(workbook, "franchisee_price_adjustment_report.xlsx", { compression: true });

        await useGlobalDialog().close(2000, 'Complete! Your spreadsheet will be downloaded shortly.')
    },

    async triggerUpdateOnAllFranchiseesWhoHaveData() {
        if (!usePricingRules().currentSession.id) return;

        const res = await useGlobalDialog().displayConfirmation('Warning!!!',
            'This will trigger adjustment data update for all franchisees who already have data. Proceed?');

        if (!res) return;

        const currentFranchiseeId = useFranchiseeStore().current.id;

        const adjustmentDataOfThisPeriod = await http.get('getPriceAdjustmentOfFranchiseeByFilter', {
            filters: [ ['custrecord_1302_master_record', 'is', usePricingRules().currentSession.id] ],
            additionalColumns: ['lastmodified', 'lastmodifiedby'],
        })

        for (let [index, adjustmentRecord] of adjustmentDataOfThisPeriod.entries()) {
            if (currentFranchiseeId === adjustmentRecord['custrecord_1302_franchisee']) continue; // we load this at the end

            useGlobalDialog().displayProgress('',
                `Updating data of franchisee <b>${adjustmentRecord['custrecord_1302_franchisee_text']}</b> (${index + 1}/${adjustmentDataOfThisPeriod.length})...`);

            console.log('Franchisee:', adjustmentRecord['custrecord_1302_franchisee'], adjustmentRecord['custrecord_1302_franchisee_text']);
            await useFranchiseeStore().changeCurrentFranchiseeId(adjustmentRecord['custrecord_1302_franchisee']);
            await waitMilliseconds(1000);
        }

        if (currentFranchiseeId) { // there was a stored franchisee id, we load it to trigger update too
            console.log('Franchisee:', currentFranchiseeId, useFranchiseeStore().current.details.companyname);
            await useFranchiseeStore().changeCurrentFranchiseeId(currentFranchiseeId)
        } else { // other we reset it to blank
            useFranchiseeStore().resetCurrent();
            usePriceAdjustment().resetAll();
        }

        await useGlobalDialog().close(1500, 'Update complete. All franchisees with data has been updated.')
    }
};

async function fetchData(ctx) {
    if (!usePricingRules().currentSession.id) return;
    
    const adjustmentDataOfThisPeriod = await http.get('getPriceAdjustmentOfFranchiseeByFilter', {
        filters: [
            ['custrecord_1302_master_record', 'is', usePricingRules().currentSession.id],
        ],
        additionalColumns: ['lastmodified', 'lastmodifiedby'],
    })

    ctx.all = useFranchiseeStore().all.map((franchisee, index) => {
        const franchiseeData = {...franchisee, highlightClass: `ag-grid-highlight-0${(index % 2)}`};

        let data = adjustmentDataOfThisPeriod.filter(item => item['custrecord_1302_franchisee'] === franchisee['internalid'])

        if (data.length === 1)
            franchiseeData['adjustmentRecord'] = data[0];
        else if (data.length > 1)
            console.log('error');
        else franchiseeData['adjustmentRecord'] = null;

        return franchiseeData;
    })
}


export const useFranchiseeManager = defineStore('franchisee-manager', {
    state: () => state,
    getters,
    actions,
});
