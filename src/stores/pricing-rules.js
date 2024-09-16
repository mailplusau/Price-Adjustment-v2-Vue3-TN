import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';
import { pricingRule } from "netsuite-shared-modules";
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

        // get the active record by looking at the missing closing date (i.e. pricing rule that is still active)
        let index = Array.isArray(data) ? data.findIndex(item => !item['custrecord_1301_closing_date']) : -1;

        if (index < 0) {
            if (!useUserStore().isAdmin) return;

            let res = await useGlobalDialog().displayConfirmation('',
                'No active Price Adjustment Record found. Would you like to initiate a new record?',
                'Initiate New Record', 'Cancel')

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
