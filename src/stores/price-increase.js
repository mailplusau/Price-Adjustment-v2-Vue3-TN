import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';
import { priceAdjustmentRecord } from "@/utils/defaults.mjs";
import { useFranchiseeStore } from "@/stores/franchisees";
import { useGlobalDialog } from "@/stores/global-dialog";
import { isoStringRegex, simpleCompare } from "@/utils/utils.mjs";
import {parse, addDays, set, subMonths} from 'date-fns';
import { useUserStore } from "@/stores/user";

const state = {
    colorList: [
        '#181a1b',
    ],

    all: [],
    currentSession: {
        id: null,
        details: {...priceAdjustmentRecord},
        texts: {...priceAdjustmentRecord},
        form: {...priceAdjustmentRecord},
        franchiseeData: [],
    },

    pricingRuleDialog: {
        open: false,
    }
};

const getters = {

};

const actions = {
    async initRules() {
        this.currentSession.details.custrecord_1301_opening_date = set(addDays(new Date(), 1), {hours: 14, minutes: 0, seconds: 0, milliseconds: 0});

        let data = await http.get('getAllPriceAdjustmentRecords');
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
    async initRecords() {
        if (!useFranchiseeStore().current.id || !this.currentSession.id) return;

        let invoices = [];
        let services = [];
        let customerRecords = {}

        let lastCustomerId = '';
        let count = -1;

        await Promise.allSettled([
            (async () => {
                invoices = await http.get('getEligibleInvoicesByFranchiseeId', {franchiseeId: useFranchiseeStore().current.id})
            })(),
            (async () => {
                services = await http.get('getActiveServicesByFranchiseeId', {franchiseeId: useFranchiseeStore().current.id})
            })(),
        ])

        services.sort((a, b) =>
            simpleCompare(a['CUSTRECORD_SERVICE_CUSTOMER.entityid'], b['CUSTRECORD_SERVICE_CUSTOMER.entityid']) ||
            simpleCompare(a['custrecord_service_franchisee_text'], b['custrecord_service_franchisee_text'])
        );

        invoices.forEach(invoice => {
            let customerId = invoice['customer.internalid'];
            if (!customerRecords[customerId])
                customerRecords[customerId] = {
                    eligibleForPriceIncrease: false,
                    has12MonthsOldInvoice: false,
                    has6MonthsOldInvoice: false,
                }

            customerRecords[customerId].eligibleForPriceIncrease = !/^(SC|NP|AP)/i.test(invoice['customer.companyname'])
                && !/(Shine Lawyer|Sendle|Dashback)/i.test(invoice['customer.companyname']);

            if (!customerRecords[customerId].has12MonthsOldInvoice)
                customerRecords[customerId].has12MonthsOldInvoice = parse(invoice['trandate'], 'd/M/y', new Date()) > subMonths(new Date(), 12);

            if (!customerRecords[customerId].has6MonthsOldInvoice)
                customerRecords[customerId].has6MonthsOldInvoice = parse(invoice['trandate'], 'd/M/y', new Date()) < subMonths(new Date(), 6);
        });

        this.currentSession.franchiseeData = services.map(service => {
            let customerId = service['CUSTRECORD_SERVICE_CUSTOMER.internalid'];
            if (!customerRecords[customerId]?.has12MonthsOldInvoice || !customerRecords[customerId]?.has6MonthsOldInvoice
                || !customerRecords[customerId]?.eligibleForPriceIncrease) return null;

            if (lastCustomerId !== customerId) {
                lastCustomerId = customerId;
                count++;
            }

            return {...service, adjustment: 0, confirmed: false, highlightClass: `ag-grid-highlight-0${(count % 2)}`}
        }).filter(service => !!service);

        // this.all = await http.get('getAllPriceIncreaseRecords');
        // TODO: get and init franchisee's own records
    },
    async createNewRuleRecord() {
        const priceIncreaseRuleData = JSON.parse(JSON.stringify(this.currentSession.form));
        priceIncreaseRuleData.custrecord_1301_pricing_rules = JSON.stringify(priceIncreaseRuleData.custrecord_1301_pricing_rules);
        let {priceIncreaseRecordId} = await http.post('saveOrCreatePriceAdjustmentRule', {priceIncreaseRuleData});
        this.currentSession.id = priceIncreaseRecordId;
        await _getCurrentSession(this);
        this.resetForm();
    },
    async savePricingRules() {
        const priceIncreaseRuleData = JSON.parse(JSON.stringify(this.currentSession.form));
        priceIncreaseRuleData.custrecord_1301_pricing_rules = JSON.stringify(priceIncreaseRuleData.custrecord_1301_pricing_rules);
        await http.post('saveOrCreatePriceAdjustmentRule',
            { priceIncreaseRecordId: this.currentSession.id, priceIncreaseRuleData });

        await _getCurrentSession(this);
        this.resetForm();
    },
    confirmAllPriceAdjustments() {
        console.log('confirmAllPriceAdjustments')
        this.currentSession.franchiseeData = this.currentSession.franchiseeData.map(item => ({...item, confirmed: true}));
    },
    resetForm() {
        this.currentSession.form = {...this.currentSession.details}
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
        if (!this.currentSession.form.custrecord_1301_effective_date) return;

        if (this.currentSession.form.custrecord_1301_effective_date <= this.currentSession.form.custrecord_1301_deadline)
            this.currentSession.form.custrecord_1301_effective_date = '';

        if (this.currentSession.form.custrecord_1301_deadline <= this.currentSession.form.custrecord_1301_opening_date)
            this.currentSession.form.custrecord_1301_deadline = '';

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

    let data = await http.get('getPriceAdjustmentRecordById', {priceIncreaseRecordId: ctx.currentSession.id});

    for (let fieldId in ctx.currentSession.details) {
        ctx.currentSession.details[fieldId] = isoStringRegex.test(data[fieldId]) ? new Date(data[fieldId]) : data[fieldId];
        ctx.currentSession.texts[fieldId] = data[fieldId + '_text'];
    }

    ctx.currentSession.details.custrecord_1301_pricing_rules = data['custrecord_1301_pricing_rules'] ? JSON.parse(data['custrecord_1301_pricing_rules']) : [];
}


export const usePriceIncreaseStore = defineStore('price-increase', {
    state: () => state,
    getters,
    actions,
});
