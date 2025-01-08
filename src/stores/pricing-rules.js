import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';
import { pricingRule } from "netsuite-shared-modules";
import { useGlobalDialog } from "@/stores/global-dialog";
import { isoStringRegex } from "@/utils/utils.mjs";
import { addDays, subDays, set, formatDistanceToNowStrict } from "date-fns";
import { useUserStore } from "@/stores/user";
import { useFranchiseeManager } from "@/stores/franchisee-manager";

let lastTick = 0;

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
    },

    pricingRuleDialog: {
        open: false,
    },

    browserDialog: {
        open: false,
    },

    timeLeftUntilDeadline: 'Unknown',
    timeLeftUntilEffectiveDate: 'Unknown'
};

const getters = {
    isSessionOpen : state => state.currentSession.id ?
        new Date() >= state.currentSession.details.custrecord_1301_opening_date && new Date() <= state.currentSession.details.custrecord_1301_effective_date : false,
    isSessionModifiable : state => state.currentSession.id ?
        new Date() >= state.currentSession.details.custrecord_1301_opening_date && new Date() <= set(state.currentSession.details.custrecord_1301_deadline, {hours: 23, minutes: 59, seconds: 59, milliseconds: 0}) : false,
    isSessionFinalised : state => state.currentSession.id ? new Date() >= state.currentSession.details.custrecord_1301_effective_date : false,

    canFranchiseeMakeChanges() { return (useUserStore().isAdmin && !this.isSessionFinalised) || this.isSessionModifiable }
};

const actions = {
    async init() {
        lastTick = (new Date()).getTime();
        this.currentSession.details.custrecord_1301_opening_date = set(addDays(new Date(), 1), {hours: 0, minutes: 0, seconds: 0, milliseconds: 0});

        let data = await http.get('getAllPriceAdjustmentRules');

        // get the active record by looking at the missing closing date (i.e. pricing rule that is still active)
        let index = Array.isArray(data) ? data.findIndex(item => !item['custrecord_1301_completion_date']) : -1;
        this.all = [...(Array.isArray(data) ? data : [])];

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
    async changeCurrentSessionId(id) {
        this.currentSession.id = id;
        await _getCurrentSession(this);
        this.resetForm();
        await useFranchiseeManager().init();
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

    addNewRule(serviceName, serviceTypeIds, adjustment, conditions) {
        this.currentSession.form.custrecord_1301_pricing_rules.push({
            serviceName,
            services: serviceTypeIds,
            adjustment,
            conditions: conditions ? JSON.parse(JSON.stringify(conditions)) : [],
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
            subDays(this.currentSession.form.custrecord_1301_effective_date, 15) <= this.currentSession.form.custrecord_1301_deadline)
            this.currentSession.form.custrecord_1301_effective_date = null;
    },
    async tick() {
        const now = (new Date()).getTime();

        if (now - lastTick < 5*1000 || useUserStore().isAdmin) return; // 5 seconds tick

        lastTick = now;

        _getCurrentSession(this, true).then();

        this.timeLeftUntilDeadline = this.currentSession.details.custrecord_1301_deadline
            ? formatDistanceToNowStrict(this.currentSession.details.custrecord_1301_deadline, {addSuffix: true}) : 'Unknown';
        this.timeLeftUntilEffectiveDate = this.currentSession.details.custrecord_1301_deadline
            ? formatDistanceToNowStrict(this.currentSession.details.custrecord_1301_effective_date, {addSuffix: true}) : 'Unknown';
    }
};

async function _getCurrentSession(ctx, updateTimeOnly = false) {
    if (!ctx.currentSession.id) return;

    const dateFields = [
        'custrecord_1301_opening_date', 'custrecord_1301_deadline', 'custrecord_1301_effective_date',
        'custrecord_1301_completion_date', 'custrecord_1301_notification_date'
    ]

    let data = await http.get('getPriceAdjustmentRuleById', {priceAdjustmentRuleId: ctx.currentSession.id}, {noErrorPopup: true});

    if (!data?.['id']) return;

    for (let fieldId in ctx.currentSession.details) {
        if (updateTimeOnly && !dateFields.includes(fieldId)) continue;
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
