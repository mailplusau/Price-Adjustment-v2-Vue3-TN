import { defineStore } from "pinia";
import { useFranchiseeStore } from "@/stores/franchisees";
import http from "@/utils/http.mjs";
import { simpleCompare } from "@/utils/utils.mjs";
import { parse, subMonths } from "date-fns";
import { usePricingRules } from "@/stores/pricing-rules";
import { priceAdjustment } from "netsuite-shared-modules";
import { useGlobalDialog } from "@/stores/global-dialog";

const state = {
    id: null,
    details: {...priceAdjustment},
    texts: {...priceAdjustment},
    form: {...priceAdjustment},

    priceAdjustmentData: [],
    savingData: false,
};

const getters = {

};

const actions = {
    async init() {
        if (!useFranchiseeStore().current.id || !usePricingRules().currentSession.id) return;

        let data = await http.get('getPriceAdjustmentOfFranchisee', {
            priceAdjustmentRuleId: usePricingRules().currentSession.id, franchiseeId: useFranchiseeStore().current.id});

        if (data.length === 1) {
            this.id = data[0]['internalid'];

            for (let fieldId in priceAdjustment) {
                this.details[fieldId] = data[0][fieldId];
                this.texts[fieldId] = data[0][fieldId + '_text'];
            }

            this.resetForm();
            await _preparePriceAdjustmentData(this);
        } else if (data.length) console.error('More than 1 record found') // TODO: Resolve this
        else {
            this.resetForm();
            this.form.custrecord_1302_master_record = usePricingRules().currentSession.id;
            this.form.custrecord_1302_franchisee = useFranchiseeStore().current.id;
            this.form.custrecord_1302_pricing_rules = [...JSON.parse(usePricingRules().currentSession.details.custrecord_1301_pricing_rules)];

            await _preparePriceAdjustmentData(this);

            await this.createPriceAdjustmentRecord();
            await this.fetchPriceAdjustmentRecord();
        }
    },
    async fetchPriceAdjustmentRecord() {
        let data = await http.get('getPriceAdjustmentOfFranchisee', {
            priceAdjustmentRuleId: usePricingRules().currentSession.id, franchiseeId: useFranchiseeStore().current.id});

        this.id = data[0]['internalid'];

        for (let fieldId in priceAdjustment) {
            this.details[fieldId] = data[0][fieldId];
            this.texts[fieldId] = data[0][fieldId + '_text'];
        }
    },
    async createPriceAdjustmentRecord() {
        _writeToDataCells(this.form, this.priceAdjustmentData);

        const priceAdjustmentData =  JSON.parse(JSON.stringify(this.form));
        priceAdjustmentData.custrecord_1302_pricing_rules = JSON.stringify(priceAdjustmentData.custrecord_1302_pricing_rules);

        await http.post('saveOrCreatePriceAdjustmentRecord', {priceAdjustmentData});
    },
    async savePriceAdjustmentRecord(applyPricingRules = false) {
        this.savingData = true;

        if (applyPricingRules) {
            applyPricingRules = await new Promise(resolve => {
                useGlobalDialog().displayInfo('Applying Pricing Rules',
                    `Would you like to overwrite all price adjustments that you made with the Pricing Rules?`,
                    true, [
                        'spacer',
                        {color: 'red', variant: 'outlined', text: 'Do not overwrite', action:() => { resolve(0) }},
                        {color: 'green', variant: 'elevated', text: 'Yes, Proceed', action:() => { resolve(1) }},
                        'spacer',
                    ]);
            });

            useGlobalDialog().displayProgress('', 'Saving Price Increase Record...');
        }

        if (applyPricingRules) {
            const priceAdjustmentData = await _getServicesOfFranchisee();
            const pricingRules = JSON.parse(JSON.stringify(this.form.custrecord_1302_pricing_rules));

            priceAdjustmentData.forEach(data => {
                for (let rule of pricingRules)
                    if (rule['services'].includes(data['custrecord_service'])) data['adjustment'] = rule['adjustment'];
            })

            this.priceAdjustmentData = [...priceAdjustmentData];
        }

        _writeToDataCells(this.form, this.priceAdjustmentData);

        const priceAdjustmentData =  JSON.parse(JSON.stringify(this.form));
        priceAdjustmentData.custrecord_1302_pricing_rules = JSON.stringify(priceAdjustmentData.custrecord_1302_pricing_rules);

        await http.post('saveOrCreatePriceAdjustmentRecord', {priceAdjustmentRecordId: this.id, priceAdjustmentData});
        this.savingData = false;
    },

    async confirmAllPriceAdjustments() {
        this.priceAdjustmentData = this.priceAdjustmentData.map(item => ({...item, confirmed: true}));
        await this.savePriceAdjustmentRecord();
    },

    addNewRule(serviceName, serviceTypeIds, adjustment) {
        this.form.custrecord_1302_pricing_rules.push({
            serviceName,
            services: serviceTypeIds,
            adjustment,
        })
    },
    removeRule(index) {
        this.form.custrecord_1302_pricing_rules.splice(index, 1);
    },

    resetForm() {
        this.form = JSON.parse(JSON.stringify(this.details));
        this.form.custrecord_1302_pricing_rules = this.form.custrecord_1302_pricing_rules ? JSON.parse(this.form.custrecord_1302_pricing_rules) : [];
    },
}

async function _getServicesOfFranchisee() {
    if (!useFranchiseeStore().current.id || !usePricingRules().currentSession.id) return;

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
        simpleCompare(a['CUSTRECORD_SERVICE_CUSTOMER.companyname'], b['CUSTRECORD_SERVICE_CUSTOMER.companyname']) ||
        simpleCompare(a['custrecord_service_franchisee_text'], b['custrecord_service_franchisee_text']) ||
        simpleCompare(a['CUSTRECORD_SERVICE_CUSTOMER.entityid'], b['CUSTRECORD_SERVICE_CUSTOMER.entityid'])
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

    return services.map(service => {
        let customerId = service['CUSTRECORD_SERVICE_CUSTOMER.internalid'];
        if (!customerRecords[customerId]?.has12MonthsOldInvoice || !customerRecords[customerId]?.has6MonthsOldInvoice
            || !customerRecords[customerId]?.eligibleForPriceIncrease) return null;

        if (lastCustomerId !== customerId) {
            lastCustomerId = customerId;
            count++;
        }

        return {...service, adjustment: 0, confirmed: false, highlightClass: `ag-grid-highlight-0${(count % 2)}`}
    }).filter(service => !!service);
}

async function _preparePriceAdjustmentData(ctx) {
    const oldAdjustmentData = _readFromDataCells(ctx.details) || [];
    const priceAdjustmentData = await _getServicesOfFranchisee();
    priceAdjustmentData.forEach(data => {
        for (let rule of ctx.form.custrecord_1302_pricing_rules)
            if (rule['services'].includes(data['custrecord_service'])) data['adjustment'] = rule['adjustment'];

        const oldIndex = oldAdjustmentData.findIndex(item => item['internalid'] === data['internalid']);

        if (oldIndex >= 0) {
            data["adjustment"] = oldAdjustmentData[oldIndex]["adjustment"];
            data["confirmed"] = oldAdjustmentData[oldIndex]["confirmed"];
        }
    })

    ctx.priceAdjustmentData = [...priceAdjustmentData];
}

function _readFromDataCells(containerObject, dataCellPrefix = 'custrecord_1302_data_') {
    try {
        let availableFields = Object.keys(containerObject).filter(field => field.includes(dataCellPrefix)).sort();
        let json = '';
        for (let fieldId of availableFields) json += containerObject[fieldId];
        return json ? JSON.parse(json) : null;
    } catch (e) { return null; }
}

function _writeToDataCells(containerObject, cellData, dataCellPrefix = 'custrecord_1302_data_') {
    let availableFields = Object.keys(containerObject).filter(field => field.includes(dataCellPrefix)).sort();
    let dataArr = _splitStringByIndex(JSON.stringify(cellData), 999990); // limit of Long Text field is 1,000,000 characters, but we stop at 999,990

    for (let [index, fieldId] of availableFields.entries())
        containerObject[fieldId] = dataArr[index] || '';

    if (dataArr.length > availableFields.length)
        console.error(`Not enough data cells. Data requires ${dataArr.length} fields however only ${availableFields.length} available.`)
}

function _splitStringByIndex(str, index) { // split json string into segments of ${index} in length
    if (!str) return [];

    return [str.substring(0, index), ..._splitStringByIndex(str.substring(index), index)]
}

export const usePriceAdjustment = defineStore('price-adjustment', {
    state: () => state,
    getters,
    actions,
});