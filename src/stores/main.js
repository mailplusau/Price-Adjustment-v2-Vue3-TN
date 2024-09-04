import { defineStore } from 'pinia';
import { getWindowContext, VARS } from "@/utils/utils.mjs";
import { useGlobalDialog } from "@/stores/global-dialog";
import { useUserStore } from "@/stores/user";
import { useFranchiseeStore } from "@/stores/franchisees";
import { usePriceIncreaseStore } from "@/stores/price-increase";
import { useDataStore } from "@/stores/data";

const state = {
    pageTitle: VARS.pageTitle,

    testMode: false,
    dev: {
        sidebar: false,
    },
};

const getters = {

};

const actions = {
    async init() {
        console.log('main store init')
        await _readUrlParams(this);
        useDataStore().init().then();
        await useUserStore().init();

        if (!useUserStore().isAdmin && !useUserStore().isFranchisee)
            return useGlobalDialog().displayError('Unauthorized', 'You do not have access to this page.', 500, [], true);

        useGlobalDialog().displayProgress('', 'Retrieving rules for Price Increase...');
        await usePriceIncreaseStore().initRules();

        useGlobalDialog().displayProgress('', 'Retrieving franchisee information...');
        await useFranchiseeStore().init();

        if (useUserStore().isFranchisee)
            useGlobalDialog().body = 'Retrieving your customers and their services...';

        await usePriceIncreaseStore().initRecords();

        if (!usePriceIncreaseStore().currentSession.id && useUserStore().isFranchisee)
            useGlobalDialog().displayError('Error', 'Price Increase is not in progress. Please check back later.');
        else useGlobalDialog().close().then();
    },
};

async function _readUrlParams(ctx) {
    let currentUrl = getWindowContext().location.href;
    let [, queryString] = currentUrl.split('?');

    const params = new Proxy(new URLSearchParams(`?${queryString}`), {
        get: (searchParams, prop) => searchParams.get(prop),
    });

    ctx.testMode = !!params['test'];
}

export const useMainStore = defineStore('main', {
    state: () => state,
    getters,
    actions,
});
