import { defineStore } from 'pinia';
import { getWindowContext, VARS } from "@/utils/utils.mjs";
import { useGlobalDialog } from "@/stores/global-dialog";
import { useUserStore } from "@/stores/user";
import { useFranchiseeStore } from "@/stores/franchisees";
import { usePricingRules } from "@/stores/pricing-rules";
import { useDataStore } from "@/stores/data";
import { usePriceAdjustment } from "@/stores/price-adjustment";

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
        await usePricingRules().init();

        useGlobalDialog().displayProgress('', 'Retrieving franchisee information...');
        await useFranchiseeStore().init();

        if (!usePricingRules().currentSession.id && useUserStore().isFranchisee)
            return useGlobalDialog().displayError('Error', 'Price Increase is not in progress. Please check back later.');

        if (useUserStore().isFranchisee)
            useGlobalDialog().body = 'Retrieving your customers and their services...';
        await usePriceAdjustment().init();

        useGlobalDialog().close().then();
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
