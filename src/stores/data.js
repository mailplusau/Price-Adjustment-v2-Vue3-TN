import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';
import { serviceTypes as testServiceTypes } from "@/utils/testData";
import { simpleCompare } from "@/utils/utils.mjs";

const state = {
    serviceChangeTypes: [],
    serviceTypes: [],
};

const getters = {

};

const actions = {
    async init() {
        await Promise.allSettled([
            this.getServiceChangeTypes(),
            this.getServiceTypes(),
        ])
    },
    async getServiceChangeTypes() {
        await _fetchDataForHtmlSelect(this.serviceChangeTypes,
            null, 'customlist_sale_type', 'internalId', 'name');
    },
    async getServiceTypes() {
        let data = await http.get('getServiceTypes');
        const serviceIdsToExclude = [2, 5, 18, 31, 32, 33, 34, 35, 36, 37, 38, 39, 43, 44, 45, 46, 21, 28, 29, 41];

        let serviceTypes = Array.isArray(data) ? [...data] : [...testServiceTypes];

        this.serviceTypes = serviceTypes
            .filter(item => !serviceIdsToExclude.includes(parseInt(item.value)))
            .map(item => ({title: item.title, value: [item.value]}));

        this.serviceTypes.unshift({
            title: 'All Services',
            value: serviceTypes.map(item => item.value),
        })

        this.serviceTypes.push(
            {
                title: 'AMPO Group',
                value: serviceTypes.filter(item => /^(AMPO ?)(\d*)$/.test(item.title)).map(item => item.value),
            },
            {
                title: 'PMPO Group',
                value: serviceTypes.filter(item => /^(PMPO ?)(\d*)$/.test(item.title)).map(item => item.value),
            },
            {
                title: 'EB Group',
                value: serviceTypes.filter(item => /^(EB ?)(\d*)$/.test(item.title)).map(item => item.value),
            },
            {
                title: 'CB Group',
                value: serviceTypes.filter(item => /^(CB ?)(\d*)$/.test(item.title)).map(item => item.value),
            },
            {
                title: 'Package: AMPO & PMPO Group',
                value: serviceTypes.filter(item => /^(Package: AMPO & PMPO ?)(\d*)$/.test(item.title)).map(item => item.value),
            }
        )
        this.serviceTypes.sort((a, b) =>
            simpleCompare(a.title, b.title)
        );
    }
};

async function _fetchDataForHtmlSelect(stateObject, id, type, valueColumnName, textColumnName) {
    stateObject.splice(0);

    let data = await http.get('getSelectOptions', {
        id, type, valueColumnName, textColumnName
    });

    data.forEach(item => { stateObject.push(item); });
}

export const useDataStore = defineStore('data', {
    state: () => state,
    getters,
    actions,
});
