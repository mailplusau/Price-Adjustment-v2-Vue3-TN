import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';
import { useFranchiseeStore } from "@/stores/franchisees";
import { simpleCompare } from "@/utils/utils.mjs";

const state = {
    data: [],
};

const getters = {

};

const actions = {
    async init() {
        if (!useFranchiseeStore().current.id) return;
        let data = await http.get('getActiveServicesByFranchiseeId', {franchiseeId: useFranchiseeStore().current.id})

        data.sort((a, b) =>
            simpleCompare(a['CUSTRECORD_SERVICE_CUSTOMER.entityid'], b['CUSTRECORD_SERVICE_CUSTOMER.entityid']) ||
            simpleCompare(a['custrecord_service_franchisee_text'], b['custrecord_service_franchisee_text'])
        );

        this.data = [...data];
    },
};


export const useServiceStore = defineStore('services', {
    state: () => state,
    getters,
    actions,
});
