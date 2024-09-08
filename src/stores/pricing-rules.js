import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';
import { pricingRule } from "@/utils/defaults.mjs";
import { useGlobalDialog } from "@/stores/global-dialog";
import { isoStringRegex } from "@/utils/utils.mjs";
import { addDays, set } from 'date-fns';
import { useUserStore } from "@/stores/user";

const state = {
    colorList: [
        '#181a1b',
    ],

    all: [],
    currentSession: {
        id: null,
        details: {...pricingRule},
        texts: {...pricingRule},
        form: {...pricingRule},
        franchiseeData: [],
    },

    pricingRuleDialog: {
        open: false,
    }
};

const getters = {

};

const actions = {
    async init() {
        this.currentSession.details.custrecord_1301_opening_date = set(addDays(new Date(), 1), {hours: 14, minutes: 0, seconds: 0, milliseconds: 0});

        let data = await http.get('getAllPriceAdjustmentRules');
        const thisYear = (new Date()).getFullYear();
        // let index = Array.isArray(data) ? data.findIndex(item => parseInt(item.custrecord_1301_year) === thisYear) : -1;
        let index = Array.isArray(data) ? data.length - 1 : -1;

        if (index < 0) {
            if (!useUserStore().isAdmin) return;

            let res = await new Promise(resolve => {
                useGlobalDialog().displayError('Error',
                    `No Price Increase rule found for the year ${thisYear}. Would you like to initialize Price Increase Rules for ${thisYear}`,
                    500, [
                        'spacer',
                        {color: 'red', variant: 'outlined', text: 'Cancel', action:() => { resolve(0) }},
                        {color: 'green', variant: 'elevated', text: 'Initialize Price Increase', action:() => { resolve(1) }},
                        'spacer',
                    ]);
            });

            if (!res) return;

            this.pricingRuleDialog.open = true;
        } else this.currentSession.id = data[index]['internalid'];

        await _getCurrentSession(this);
        this.resetForm();
    },
    async createNewRuleRecord() {
        const priceIncreaseRuleData = JSON.parse(JSON.stringify(this.currentSession.form));
        priceIncreaseRuleData.custrecord_1301_pricing_rules = JSON.stringify(priceIncreaseRuleData.custrecord_1301_pricing_rules);
        let {priceAdjustmentRuleId} = await http.post('saveOrCreatePriceAdjustmentRule', {priceIncreaseRuleData});
        this.currentSession.id = priceAdjustmentRuleId;
        await _getCurrentSession(this);
        this.resetForm();
    },
    async savePricingRules() {
        const priceIncreaseRuleData = JSON.parse(JSON.stringify(this.currentSession.form));
        priceIncreaseRuleData.custrecord_1301_pricing_rules = JSON.stringify(priceIncreaseRuleData.custrecord_1301_pricing_rules);
        await http.post('saveOrCreatePriceAdjustmentRule',
            { priceAdjustmentRuleId: this.currentSession.id, priceIncreaseRuleData });

        await _getCurrentSession(this);
        this.resetForm();
    },
    resetForm() {
        this.currentSession.form = JSON.parse(JSON.stringify(this.currentSession.details));
        this.currentSession.form.custrecord_1301_opening_date = parseISOStringIfExist(this.currentSession.form.custrecord_1301_opening_date);
        this.currentSession.form.custrecord_1301_deadline = parseISOStringIfExist(this.currentSession.form.custrecord_1301_deadline);
        this.currentSession.form.custrecord_1301_effective_date = parseISOStringIfExist(this.currentSession.form.custrecord_1301_effective_date);
        this.currentSession.form.custrecord_1301_pricing_rules = this.currentSession.form.custrecord_1301_pricing_rules ? JSON.parse(this.currentSession.form.custrecord_1301_pricing_rules) : [];
    },

    addNewRule(serviceName, serviceTypeIds, adjustment) {
        this.currentSession.form.custrecord_1301_pricing_rules.push({
            serviceName,
            services: serviceTypeIds,
            adjustment,
        })
    },
    removeRule(index) {
        this.currentSession.form.custrecord_1301_pricing_rules.splice(index, 1);
    },

    handleDatesChanged() {
        if (!this.currentSession.form.custrecord_1301_deadline ||
            this.currentSession.form.custrecord_1301_deadline <= this.currentSession.form.custrecord_1301_opening_date)
            this.currentSession.form.custrecord_1301_deadline = null;

        if (!this.currentSession.form.custrecord_1301_effective_date || !this.currentSession.form.custrecord_1301_deadline ||
            this.currentSession.form.custrecord_1301_effective_date <= this.currentSession.form.custrecord_1301_deadline)
            this.currentSession.form.custrecord_1301_effective_date = null;

        if (this.currentSession.form.custrecord_1301_effective_date) {
            this.currentSession.form.custrecord_1301_year = (this.currentSession.form.custrecord_1301_effective_date).getFullYear();
            this.currentSession.form.custrecord_1301_month = (this.currentSession.form.custrecord_1301_effective_date).getMonth() + 1;
        } else {
            this.currentSession.form.custrecord_1301_year = '';
            this.currentSession.form.custrecord_1301_month = '';
        }
    },
};

async function _getCurrentSession(ctx) {
    if (!ctx.currentSession.id) return;

    let data = await http.get('getPriceAdjustmentRuleById', {priceAdjustmentRuleId: ctx.currentSession.id});

    for (let fieldId in ctx.currentSession.details) {
        ctx.currentSession.details[fieldId] = isoStringRegex.test(data[fieldId]) ? new Date(data[fieldId]) : data[fieldId];
        ctx.currentSession.texts[fieldId] = data[fieldId + '_text'];
    }
}

function parseISOStringIfExist(isoString) {
    return isoStringRegex.test(isoString) ? new Date(isoString) : isoString;
}


export const usePricingRules = defineStore('pricing-rules', {
    state: () => state,
    getters,
    actions,
});
