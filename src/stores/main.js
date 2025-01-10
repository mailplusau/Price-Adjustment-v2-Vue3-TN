import { defineStore } from 'pinia';
import { getWindowContext, VARS } from "@/utils/utils.mjs";
import { useGlobalDialog } from "@/stores/global-dialog";
import { useUserStore } from "@/stores/user";
import { useFranchiseeStore } from "@/stores/franchisees";
import { usePricingRules } from "@/stores/pricing-rules";
import { useDataStore } from "@/stores/data";
import { usePriceAdjustment } from "@/stores/price-adjustment";

let masterClock;

const state = {
    pageTitle: VARS.pageTitle,

    testMode: false,
    mainPage: {
        current: 'price_adjustment',
        options: {
            PRICE_ADJ: 'price_adjustment',
            FRANCHISEE_MGMT: 'franchisee_management',
            BACKUP_MGMT: 'backup_management',
        }
    },
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
        _startMasterClock(this);

        useDataStore().init().then();
        await useUserStore().init();

        if (!useUserStore().isAdmin && !useUserStore().isFranchisee)
            return useGlobalDialog().displayError('Unauthorized',
                'You do not have access to this page.', 500, [], true);

        useGlobalDialog().displayProgress('', 'Retrieving rules for Price Increase...');
        await usePricingRules().init();

        useGlobalDialog().displayProgress('', 'Retrieving franchisee information...');
        await useFranchiseeStore().init();

        if ((!usePricingRules().currentSession.id || !usePricingRules().isSessionOpen) && !useUserStore().isAdmin)
            return useGlobalDialog().displayError('Error',
                'Price Increase is not in progress. Please check back later.', 500, [], true);

        if (useUserStore().isFranchisee)
            useGlobalDialog().body = 'Retrieving your customers and their services...';

        await usePriceAdjustment().init();

        if (usePriceAdjustment().details.custrecord_1302_opt_out_reason && !useUserStore().isAdmin)
            return useGlobalDialog().displayInfo('Session closed', 'You have previously chose to skip this price increase period. If you changed your mind, please contact us.', true, [], true);

        useGlobalDialog().close().then();
    },
    addShortcut() {
        if (top['addShortcut']) top['addShortcut']();
        else console.error('addShortcut function not found.')
    }
};

async function _readUrlParams(ctx) {
    let currentUrl = getWindowContext().location.href;
    let [, queryString] = currentUrl.split('?');

    const params = new Proxy(new URLSearchParams(`?${queryString}`), {
        get: (searchParams, prop) => searchParams.get(prop),
    });

    ctx.testMode = !!params['test'];
}

function _startMasterClock() {
    if (masterClock) return;

    masterClock = setInterval(() => {
        usePricingRules().tick().then();
    }, 1000);
}

export const useMainStore = defineStore('main', {
    state: () => state,
    getters,
    actions,
});
