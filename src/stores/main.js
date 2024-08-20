import { defineStore } from 'pinia';
import {VARS} from "@/utils/utils.mjs";

const state = {
    pageTitle: VARS.pageTitle,

    dev: {
        sidebar: false,
    },
};

const getters = {

};

const actions = {
    async init() {
        console.log('main store init')

    },
};

export const useMainStore = defineStore('main', {
    state: () => state,
    getters,
    actions,
});
