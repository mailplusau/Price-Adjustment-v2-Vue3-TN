import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';
import { RECORD_TYPE, jsonDataHistory, readFromDataCells, writeToDataCells } from "netsuite-shared-modules";
import diff from "microdiff";
import { usePriceAdjustment } from "@/stores/price-adjustment";

const state = {
    selectedPriceAdjustmentId: null,
    historyDialogOpen: false,
    historyData: [],
    loading: false,
};

const getters = {

};

const actions = {
    async openHistoryDialog(priceAdjustmentId) {
        this.selectedPriceAdjustmentId = priceAdjustmentId;
        this.loading = true;
        this.historyDialogOpen = true;
        this.historyData.splice(0);
        if (!this.selectedPriceAdjustmentId) return this.loading = false;
        const res = await Promise.allSettled([
            http.get('getPriceAdjustmentOfFranchiseeByFilter', {filters: [
                ['internalid', 'is', priceAdjustmentId]
                ], additionalColumns: ['owner', 'created']}),
            http.get('getJsonDataHistoryByFilters', {filters: [
                    ['custrecord_1318_related_record', 'is', this.selectedPriceAdjustmentId], 'AND',
                    ['custrecord_related_record_type', 'is', RECORD_TYPE.PRICE_ADJUSTMENT_DATA]
                ], additionalColumns: ['owner', 'created']})
        ])
        const historyData = res[1]['status'] === 'fulfilled' ? res[1]['value'] : null;
        const adjustmentDataInfo = res[0]['status'] === 'fulfilled' ? res[0]['value'][0] : null;

        this.historyData = Array.isArray(historyData) ? [...historyData] : [];
        this.historyData.push({
            owner: adjustmentDataInfo['owner'],
            owner_text: adjustmentDataInfo['owner_text'],
            created: adjustmentDataInfo['created'],
            created_text: adjustmentDataInfo['created_text'],
            isOriginRecord: true
        })

        this.loading = false;
    },
    async recordAdjustmentDataHistory() {
        const oldAdjustmentData = readFromDataCells(usePriceAdjustment().details, 'custrecord_1302_data_');
        const newAdjustmentData = readFromDataCells(usePriceAdjustment().form, 'custrecord_1302_data_');
        const difference = diff(oldAdjustmentData, newAdjustmentData);

        if (Array.isArray(difference) && difference.length) {
            const historyData = {...jsonDataHistory};
            const referenceData = {};
            difference.filter(i => i['type'] === 'CHANGE').forEach(d => {
                if (!referenceData[d.path[0]]) referenceData[d.path[0]] = oldAdjustmentData[d.path[0]]
            })

            historyData.custrecord_1318_related_record = usePriceAdjustment().id;
            historyData.custrecord_related_record_type = RECORD_TYPE.PRICE_ADJUSTMENT_DATA;

            writeToDataCells(historyData, { referenceData, difference }, 'custrecord_1318_data_');

            await http.post('createJsonDataHistory', {historyData}, {noErrorPopup: true});
        }
    }
};


export const usePriceAdjustmentHistoryStore = defineStore('adjustment-history', {
    state: () => state,
    getters,
    actions,
});
