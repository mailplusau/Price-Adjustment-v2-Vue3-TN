import { defineStore } from 'pinia';
import { usePricingRules } from "@/stores/pricing-rules";
import http from "@/utils/http.mjs";
import { waitMilliseconds } from "@/utils/utils.mjs";
import { priceAdjustment } from "netsuite-shared-modules";

const backupFolderId = 4369812;
const state = {
    ofCurrentSession: {
        backupFiles: [],

        selectedFile: null,
        backupData: [],
    },
};

const getters = {

};

const actions = {
    async init() {
        if (!top.location.href.includes('app.netsuite') || !usePricingRules().currentSession.id) return;

        this.ofCurrentSession.backupFiles.splice(0);

        const data = await http.get('getFilesByFilters', {filters: [
                ['name', 'contains', `mr${usePricingRules().currentSession.id}`],
                'AND',
                ['folder', 'is', backupFolderId]
            ]});

        if (!Array.isArray(data)) return;

        for (let file of data) {
            const [session, order, total, timestamp] = file.name.split('_');

            const index = this.ofCurrentSession.backupFiles.findIndex(item => item.name === timestamp);

            if (index < 0) {
                this.ofCurrentSession.backupFiles.push({
                    name: timestamp,
                    sessionId: session.replace('mr', ''),
                    total,
                    sizeKB: parseFloat(file['documentSize'.toLowerCase()]),
                    created: file.created,
                    files: [{ order, id: file.internalid, url: file.url, }]
                })
            } else {
                this.ofCurrentSession.backupFiles[index].files.push({ order, id: file.internalid, url: file.url });
                this.ofCurrentSession.backupFiles[index].sizeKB += parseFloat(file['documentSize'.toLowerCase()])

                this.ofCurrentSession.backupFiles[index].files.sort((a, b) =>
                    parseInt(a.order) - parseInt(b.order),
                );
            }
        }
    },
    async retrieveBackupFileData(fileName) {
        this.ofCurrentSession.selectedFile = null;
        this.ofCurrentSession.backupData.splice(0);

        const index = this.ofCurrentSession.backupFiles.findIndex(item => item.name === fileName);

        if (index < 0) return;

        this.ofCurrentSession.selectedFile = fileName;
        const res = await Promise.all(this.ofCurrentSession.backupFiles[index].files
            .map(file => http.get('getFileContentById', {fileId: file.id})));

        const franchiseeAdjustmentRecords = JSON.parse(res.join(''));
        this.ofCurrentSession.backupData = Array.isArray(franchiseeAdjustmentRecords) ? [...franchiseeAdjustmentRecords] : [];
    },
    async restoreFranchiseeDataFromBackupData(recordInternalId) {
        let index = this.ofCurrentSession.backupData.findIndex(item => item['internalid'] === recordInternalId);

        if (index < 0) return;

        await waitMilliseconds(1000);

        const adjustmentData = {};

        for (let fieldId in priceAdjustment)
            adjustmentData[fieldId] = this.ofCurrentSession.backupData[index][fieldId]

        // await http.post('saveOrCreatePriceAdjustmentRecord', {
        //     priceAdjustmentRecordId: this.ofCurrentSession.backupData[index]['internalid'],
        //     adjustmentData
        // });

        console.log(this.ofCurrentSession.backupData[index]['internalid'])
        console.log(adjustmentData)
    }
};


export const useBackupManager = defineStore('backup-manager', {
    state: () => state,
    getters,
    actions,
});
