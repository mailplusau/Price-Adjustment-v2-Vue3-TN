import { defineStore } from "pinia";
import { useFranchiseeStore } from "@/stores/franchisees";
import http from "@/utils/http.mjs";
import { pricingRuleOperatorOptions, simpleCompare } from "@/utils/utils.mjs";
import { parse, subMonths, subYears, format } from "date-fns";
import { usePricingRules } from "@/stores/pricing-rules";
import { priceAdjustment, readFromDataCells, writeToDataCells } from "netsuite-shared-modules";
import { useGlobalDialog } from "@/stores/global-dialog";
import { useUserStore } from "@/stores/user";
import { priceAdjustmentTypes } from "@/utils/defaults.mjs";
import { utils, writeFile } from "xlsx";

const state = {
    id: null,
    details: {...priceAdjustment},
    texts: {...priceAdjustment},
    form: {...priceAdjustment},

    priceAdjustmentData: [],
    savingData: false,
};

const getters = {

};

const actions = {
    async init() {
        if (!useFranchiseeStore().current.id || !usePricingRules().currentSession.id) return;

        let data = await http.get('getPriceAdjustmentOfFranchisee', {
            priceAdjustmentRuleId: usePricingRules().currentSession.id, franchiseeId: useFranchiseeStore().current.id});

        if (data.length === 1) {
            this.id = data[0]['internalid'];

            for (let fieldId in priceAdjustment) {
                this.details[fieldId] = data[0][fieldId];
                this.texts[fieldId] = data[0][fieldId + '_text'];
            }

            this.resetForm();

            if (!!this.details.custrecord_1302_opt_out_reason && !useUserStore().isAdmin) return;

            await _preparePriceAdjustmentData(this);

            writeToDataCells(this.form, this.priceAdjustmentData, 'custrecord_1302_data_');

            const priceAdjustmentData =  JSON.parse(JSON.stringify(this.form));
            priceAdjustmentData.custrecord_1302_pricing_rules = JSON.stringify(priceAdjustmentData.custrecord_1302_pricing_rules);

            await http.post('saveOrCreatePriceAdjustmentRecord', {priceAdjustmentRecordId: this.id, priceAdjustmentData});
        } else if (data.length) {
            console.error("More than 1 record found"); // TODO: Resolve this
        } else {
            for (let fieldId in this.form) this.form[fieldId] = priceAdjustment[fieldId];

            this.form.custrecord_1302_master_record = usePricingRules().currentSession.id;
            this.form.custrecord_1302_franchisee = useFranchiseeStore().current.id;
            this.form.custrecord_1302_pricing_rules = [...JSON.parse(usePricingRules().currentSession.details.custrecord_1301_pricing_rules)];

            await _preparePriceAdjustmentData(this);

            await this.createPriceAdjustmentRecord();
            await this.fetchPriceAdjustmentRecord();

            this.resetForm();
        }
    },
    async fetchPriceAdjustmentRecord() {
        let data = await http.get('getPriceAdjustmentOfFranchisee', {
            priceAdjustmentRuleId: usePricingRules().currentSession.id, franchiseeId: useFranchiseeStore().current.id});

        this.id = data[0]['internalid'];

        for (let fieldId in priceAdjustment) {
            this.details[fieldId] = data[0][fieldId];
            this.texts[fieldId] = data[0][fieldId + '_text'];
        }
    },
    async createPriceAdjustmentRecord() {
        writeToDataCells(this.form, this.priceAdjustmentData, 'custrecord_1302_data_');

        const priceAdjustmentData =  JSON.parse(JSON.stringify(this.form));
        priceAdjustmentData.custrecord_1302_pricing_rules = JSON.stringify(priceAdjustmentData.custrecord_1302_pricing_rules);

        await http.post('saveOrCreatePriceAdjustmentRecord', {priceAdjustmentData});
    },
    async savePriceAdjustmentRecord(applyPricingRules = false) {
        this.savingData = true;

        if (applyPricingRules) {
            applyPricingRules = await new Promise(resolve => {
                useGlobalDialog().displayInfo('Applying Pricing Rules',
                    `Would you like to overwrite all price adjustments that you made with the Pricing Rules?`,
                    true, [
                        'spacer',
                        {color: 'red', variant: 'outlined', text: 'Do not overwrite', action:() => { resolve(0) }},
                        {color: 'green', variant: 'elevated', text: 'Yes, Proceed', action:() => { resolve(1) }},
                        'spacer',
                    ]);
            });

            useGlobalDialog().displayProgress('', 'Saving Price Increase Record...');
        }

        if (applyPricingRules) await _preparePriceAdjustmentData(this, true)

        writeToDataCells(this.form, this.priceAdjustmentData, 'custrecord_1302_data_');

        const priceAdjustmentData =  JSON.parse(JSON.stringify(this.form));
        priceAdjustmentData.custrecord_1302_pricing_rules = JSON.stringify(priceAdjustmentData.custrecord_1302_pricing_rules);

        await http.post('saveOrCreatePriceAdjustmentRecord', {priceAdjustmentRecordId: this.id, priceAdjustmentData});
        this.savingData = false;
    },

    async confirmAllPriceAdjustments() {
        this.priceAdjustmentData = this.priceAdjustmentData.map(item => ({...item, confirmed: true}));
        await this.savePriceAdjustmentRecord();
    },
    async optOutOfPriceAdjustments(optOutReason) {
        await useGlobalDialog().displayProgress('', 'Opting out of this Price Increase period...')

        this.priceAdjustmentData = this.priceAdjustmentData.map(item => ({...item, confirmed: false}));
        await this.savePriceAdjustmentRecord();
        await http.post('optOutOfPriceAdjustmentPeriod', {
            priceAdjustmentRecordId: usePriceAdjustment().id,
            franchiseeId: useFranchiseeStore().current.id,
            optOutReason
        })

        this.priceAdjustmentData = [];
        await useGlobalDialog().close(2000, 'Complete');
        useGlobalDialog().displayInfo('', 'You have opted out of this period for Price Increase. You can now close this page.', true, [], true);
    },

    addNewRule(serviceName, serviceTypeIds, adjustment, conditions) {
        this.form.custrecord_1302_pricing_rules.push({
            serviceName,
            services: serviceTypeIds,
            adjustment,
            conditions: conditions ? JSON.parse(JSON.stringify(conditions)) : [],
        })
    },
    removeRule(index) {
        this.form.custrecord_1302_pricing_rules.splice(index, 1);
    },

    resetForm() {
        this.form = JSON.parse(JSON.stringify(this.details));
        this.form.custrecord_1302_pricing_rules = this.form.custrecord_1302_pricing_rules ? JSON.parse(this.form.custrecord_1302_pricing_rules) : [];
    },

    async sendTestNotificationEmail() {
        if (!usePricingRules().currentSession.id) return;

        useGlobalDialog().displayProgress('', 'Sending test notification email...');
        await http.post('sendTestNotificationEmail', {sessionId: usePricingRules().currentSession.id});
        await useGlobalDialog().close(500, 'Complete!');
    },

    async exportDataToSpreadsheet() {
        useGlobalDialog().displayProgress('', 'Generating Spreadsheet...');

        const excelRows = this.priceAdjustmentData.map(item => ({
            internalId: item['CUSTRECORD_SERVICE_CUSTOMER.internalid'],
            entityId: item['CUSTRECORD_SERVICE_CUSTOMER.entityid'],
            customer: item['CUSTRECORD_SERVICE_CUSTOMER.companyname'],
            franchisee: item['custrecord_service_franchisee_text'],
            service: item['custrecord_service_text'],
            servicePrice: parseFloat(item['custrecord_service_price']),
            adjustment: parseFloat(item['adjustment'])
        }))

        const headers = ['Internal ID', 'Entity ID', 'Customer', 'Franchisee', 'Service', 'Service Price', 'Adjustment'];

        const workbook = utils.book_new();
        const worksheet = utils.json_to_sheet(excelRows);

        utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });
        utils.sheet_add_json(worksheet, excelRows, { origin: 'A2', skipHeader: true });
        utils.book_append_sheet(workbook, worksheet, "Report");

        writeFile(workbook, `${this.texts.custrecord_1302_franchisee}.xlsx`, { compression: true });

        await useGlobalDialog().close(2000, 'Complete');
    }
}

async function _getServicesOfFranchisee() {
    if (!useFranchiseeStore().current.id || !usePricingRules().currentSession.id) return;

    let invoices = [];
    let services = [];
    let customerRecords = {}

    let lastCustomerId = '';
    let count = -1;
    const periods = [
        ['monthsago3', 'daysago0'],
        ['monthsago6', 'monthsago3'],
        ['monthsago15', 'monthsago12'],
        ['monthsago18', 'monthsago15'],
        ['monthsago21', 'monthsago18'],
        ['monthsago24', 'monthsago21'],
        ['monthsago27', 'monthsago24'],
        ['monthsago30', 'monthsago27'],
        ['monthsago33', 'monthsago30'],
        ['monthsago36', 'monthsago33'],
    ]

    await Promise.allSettled([
        ...periods.map( async ([start, end]) => {
            invoices.push(...(await http.get('getEligibleInvoicesByFranchiseeIdWithinPeriods', {franchiseeId: useFranchiseeStore().current.id, start, end})))
        }),
        (async () => {
            services = await http.get('getActiveServicesByFranchiseeId', {
                franchiseeId: useFranchiseeStore().current.id,
                dateOfLastPriceAdjustment: format(subYears(new Date(usePricingRules().currentSession.details.custrecord_1301_effective_date), 1), 'd/M/y'),
            })
        })(),
    ])

    services.sort((a, b) =>
        simpleCompare(a['CUSTRECORD_SERVICE_CUSTOMER.companyname'], b['CUSTRECORD_SERVICE_CUSTOMER.companyname']) ||
        simpleCompare(a['custrecord_service_franchisee_text'], b['custrecord_service_franchisee_text']) ||
        simpleCompare(a['CUSTRECORD_SERVICE_CUSTOMER.entityid'], b['CUSTRECORD_SERVICE_CUSTOMER.entityid'])
    );

    invoices.forEach(invoice => {
        let customerId = invoice['customer.internalid'];
        if (!customerRecords[customerId])
            customerRecords[customerId] = {
                eligibleForPriceIncrease: false,
                has12MonthsOldInvoice: false,
                has6MonthsOldInvoice: false,
            }

        customerRecords[customerId].eligibleForPriceIncrease = !/^(SC |NP |AP )/i.test(invoice['customer.companyname'])
            && !/(Shine Lawyer|Sendle|Dashback)/i.test(invoice['customer.companyname']);

        if (!customerRecords[customerId].has12MonthsOldInvoice)
            customerRecords[customerId].has12MonthsOldInvoice = parse(invoice["trandate"], "d/M/y", new Date()) <= subMonths(new Date(), 12);

        if (!customerRecords[customerId].has6MonthsOldInvoice)
            customerRecords[customerId].has6MonthsOldInvoice = parse(invoice['trandate'], 'd/M/y', new Date()) >= subMonths(new Date(), 6);
    });

    return services.map(service => {
        let customerId = service['CUSTRECORD_SERVICE_CUSTOMER.internalid'];
        if (!customerRecords[customerId]?.has12MonthsOldInvoice || !customerRecords[customerId]?.has6MonthsOldInvoice
            || !customerRecords[customerId]?.eligibleForPriceIncrease) return null;

        if (lastCustomerId !== customerId) {
            lastCustomerId = customerId;
            count++;
        }

        return {...service, adjustment: 0, confirmed: false, highlightClass: `ag-grid-highlight-0${(count % 2)}`}
    }).filter(service => !!service);
}

async function _preparePriceAdjustmentData(ctx, ignoreOldAdjustmentData = false) {
    const oldAdjustmentData = ignoreOldAdjustmentData ? [] : (readFromDataCells(ctx.details, 'custrecord_1302_data_') || []);
    const priceAdjustmentData = await _getServicesOfFranchisee();
    const pricingRules = JSON.parse(JSON.stringify(ctx.form.custrecord_1302_pricing_rules));

    priceAdjustmentData.forEach(data => {
        for (let rule of pricingRules) // apply pricing rule
            if (rule['services'].includes(data['custrecord_service']))
                data["adjustment"] = _applyPricingRules(rule, data['custrecord_service_price']);

        const oldIndex = oldAdjustmentData.findIndex(item => item['internalid'] === data['internalid']);

        if (oldIndex >= 0) { // overwrite with old data if any
            data["adjustment"] = oldAdjustmentData[oldIndex]["adjustment"];
            data["confirmed"] = oldAdjustmentData[oldIndex]["confirmed"];
        }

        _applySpecialRules(data);
    })

    ctx.priceAdjustmentData = [...priceAdjustmentData];
}

function _applySpecialRules(data) { // apply master rules for National Accounts customers and confirm them too
    if (data['CUSTRECORD_SERVICE_CUSTOMER.custentitycustentity_fin_national']) {
        const pricingRules = JSON.parse(usePricingRules().currentSession.details.custrecord_1301_pricing_rules);

        data['confirmed'] = true;
        for (let rule of pricingRules) {
            if (rule["services"].includes(data["custrecord_service"]))
                data["adjustment"] = _applyPricingRules(rule, data["custrecord_service_price"]);
        }
    }
}

function _applyPricingRules(pricingRule, currentPrice) {
    let adjustment = 0;
    if (pricingRule['conditions'].length) {
        let [fieldName, operator, operand1, operand2] = pricingRule['conditions'][0];
        if (!fieldName) console.log('fieldName', fieldName);
        let operatorIndex = pricingRuleOperatorOptions.findIndex(item => item.value === operator)
        if (pricingRuleOperatorOptions[operatorIndex]?.['eval'](parseFloat(currentPrice), operand1, operand2))
            adjustment = _calculateAdjustment(pricingRule, parseFloat(currentPrice));
    } else adjustment = _calculateAdjustment(pricingRule, parseFloat(currentPrice));

    return adjustment;
}

function _calculateAdjustment(rule, servicePrice) {
    if (rule['adjustmentType'] === priceAdjustmentTypes.AMOUNT.name)
        return rule['adjustment'];

    if (rule['adjustmentType'] === priceAdjustmentTypes.PERCENT.name)
        return servicePrice * rule['adjustment'] / 100;

    if (rule['adjustmentType'] === priceAdjustmentTypes.FIXED.name)
        return rule['adjustment'] - servicePrice;

    return 0;
}

export const usePriceAdjustment = defineStore('price-adjustment', {
    state: () => state,
    getters,
    actions,
});