/**
 * @author Tim Nguyen
 * @description NetSuite Experimentation - Yearly Price Increase
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @created 20/08/2024
 */

import {VARS} from '@/utils/utils.mjs';
import { franchisee as franchiseeFields, pricingRule as pricingRuleFields } from "netsuite-shared-modules";
import { getFranchiseesByFilters, getPriceAdjustmentRulesByFilters, getCustomersByFilters, getInvoicesByFilters, getPriceAdjustmentOfFranchiseeByFilter, getServicesByFilters } from 'netsuite-shared-modules';

// These variables will be injected during upload. These can be changed under 'netsuite' of package.json
let htmlTemplateFilename;
let clientScriptFilename;

const isoStringRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z?$/;
const defaultTitle = VARS.pageTitle;

let NS_MODULES = {};


// eslint-disable-next-line no-undef
define(['N/ui/serverWidget', 'N/render', 'N/search', 'N/file', 'N/log', 'N/record', 'N/email', 'N/runtime', 'N/https', 'N/task', 'N/format', 'N/url'],
    (serverWidget, render, search, file, log, record, email, runtime, https, task, format, url) => {
        NS_MODULES = {serverWidget, render, search, file, log, record, email, runtime, https, task, format, url};

        const onRequest = ({request, response}) => {
            if (request.method === "GET") {

                if (!_.handleGETRequests(request.parameters['requestData'], response)){
                    // Render the page using either inline form or standalone page
                    if (request.parameters['standalone']) _.getStandalonePage(response)
                    else _.getInlineForm(response)
                }

            } else if (request.method === "POST") { // Request method should be POST (?)
                _.handlePOSTRequests(JSON.parse(request.body), response);
                // _writeResponseJson(response, {test: 'test response from post', params: request.parameters, body: request.body});
            } else log.debug({ title: "request method type", details: `method : ${request.method}` });

        }

        const _ = {
            // Render the htmlTemplateFile as a standalone page without any of NetSuite's baggage. However, this also means no
            // NetSuite module will be exposed to the Vue app. Thus, an api approach using Axios and structuring this Suitelet as
            // a http request handler will be necessary. For reference:
            // https://medium.com/@vladimir.aca/how-to-vuetify-your-suitelet-on-netsuite-part-2-axios-http-3e8e731ac07c
            getStandalonePage(response) {
                let {file} = NS_MODULES;

                // Get the id and url of our html template file
                const htmlFileData = this.getHtmlTemplate(htmlTemplateFilename);

                // Load the  html file and store it in htmlFile
                const htmlFile = file.load({id: htmlFileData[htmlTemplateFilename].id});

                response.write(htmlFile['getContents']());
            },
            // Render the page within a form element of NetSuite. This can cause conflict with NetSuite's stylesheets.
            getInlineForm(response) {
                let {serverWidget} = NS_MODULES;

                // Create a NetSuite form
                let form = serverWidget['createForm']({ title: defaultTitle });

                // Retrieve client script ID using its file name.
                form.clientScriptFileId = this.getHtmlTemplate(clientScriptFilename)[clientScriptFilename].id;

                response['writePage'](form);
            },
            // Search for the ID and URL of a given file name inside the NetSuite file cabinet
            getHtmlTemplate(htmlPageName) {
                let {search} = NS_MODULES;

                const htmlPageData = {};

                search.create({
                    type: 'file',
                    filters: ['name', 'is', htmlPageName],
                    columns: ['name', 'url']
                }).run().each(resultSet => {
                    htmlPageData[resultSet['getValue']({ name: 'name' })] = {
                        url: resultSet['getValue']({ name: 'url' }),
                        id: resultSet['id']
                    };
                    return true;
                });

                return htmlPageData;
            },
            handleGETRequests(request, response) {
                if (!request) return false;

                try {
                    let {operation, requestParams} = this.validateRequest('GET', request);

                    if (operation === 'getIframeContents') this.getIframeContents(response);
                    else getOperations[operation](response, requestParams);
                } catch (e) {
                    NS_MODULES.log.debug({title: "_handleGETRequests", details: `error: ${e}`});
                    this.handleError(request, e)
                    _writeResponseJson(response, {error: `${e}`})
                }

                return true;
            },
            handlePOSTRequests(request, response) {
                if (!request) return;

                let {operation, requestParams} = this.validateRequest('POST', request);
                try {

                    postOperations[operation](response, requestParams);
                } catch (e) {
                    NS_MODULES.log.debug({title: "_handlePOSTRequests", details: `error: ${e}`});
                    this.handleError(JSON.stringify(request), e)
                    _writeResponseJson(response, {error: `${e}`})
                }
            },
            getIframeContents(response) {
                const htmlFileData = this.getHtmlTemplate(htmlTemplateFilename);
                const htmlFile = NS_MODULES.file.load({ id: htmlFileData[htmlTemplateFilename].id });

                _writeResponseJson(response, htmlFile['getContents']());
            },
            validateRequest(method, request) {
                let {operation, requestParams} = method === 'POST' ? request : JSON.parse(request);
                if (!operation) throw 'No operation specified.';

                if (method === 'POST' && !postOperations[operation]) throw `POST operation [${operation}] is not supported.`;
                else if (method === 'GET' && !getOperations[operation] && operation !== 'getIframeContents')
                    throw `GET operation [${operation}] is not supported.`;

                return {operation, requestParams};
            },
            handleError(request, e) {
                try {
                    const currentScript = NS_MODULES.runtime['getCurrentScript']();
                    NS_MODULES.email['sendBulk'].promise({
                        author: 112209,
                        body: `User: ${JSON.stringify(NS_MODULES.runtime['getCurrentUser']())}<br><br>Incoming request data: ${request}<br><br>Stacktrace: ${e}`,
                        subject: `[ERROR][SCRIPT=${currentScript.id}][DEPLOY=${currentScript.deploymentId}]`,
                        recipients: ['tim.nguyen@mailplus.com.au'],
                        isInternalOnly: true
                    });
                    NS_MODULES.log.error('Error handled', `${e}`);
                } catch (error) { NS_MODULES.log.error('failed to handle error', `${error}`); }
            }
        }

        return {onRequest};
    });

function _writeResponseJson(response, body) {
    response['addHeader']({name: 'Content-Type', value: 'application/json; charset=utf-8'});
    response.write({ output: JSON.stringify(body) });
}


const getOperations = {
    'getCurrentUserDetails' : function (response) {
        let user = {role: NS_MODULES.runtime['getCurrentUser']().role, id: NS_MODULES.runtime['getCurrentUser']().id};
        let salesRep = {};

        if (parseInt(user.role) === 1000) {
            let franchiseeRecord = NS_MODULES.record.load({type: 'partner', id: user.id});
            let employeeId = franchiseeRecord.getValue({fieldId: 'custentity_sales_rep_assigned'});
            let employeeRecord = NS_MODULES.record.load({type: 'employee', id: employeeId});
            salesRep['id'] = employeeId;
            salesRep['name'] = `${employeeRecord.getValue({fieldId: 'firstname'})} ${employeeRecord.getValue({fieldId: 'lastname'})}`;
        }

        _writeResponseJson(response, {...user, salesRep});
    },
    'getFranchiseeDetails' : function (response, {franchiseeId}) {
        let partner = {};

        let partnerRecord = NS_MODULES.record.load({type: 'partner', id: franchiseeId})
        for (let fieldId of Object.keys(franchiseeFields)) {
            partner[fieldId] = partnerRecord['getValue']({fieldId});
            partner[fieldId + '_text'] = partnerRecord['getText']({fieldId});
        }

        _writeResponseJson(response, partner);
    },
    'getAllFranchisees' : function (response) {
        _writeResponseJson(response, getFranchiseesByFilters(NS_MODULES, [
            ['isInactive'.toLowerCase(), 'is', false]
        ]));
    },
    'getCustomers' : function (response) {
        let franchiseesToExclude = [
            212, // Acacia Ridge
            214, // Airport West
            1640044, // Altona
            1796642, // Arncliffe
            64113, // Banyo
            1816660, // Barton
            143, // Baulkham Hills
            1818659, // Bayswater
            1787308, // Belmont
            1836662, // Blacktown
            219, // Bondi Junction
            453361, // Booval
            280, // Botany Botany
            236, // Geelong
            554481, // Lane Cove
            261, // Lane Lane
            249, // Launceston
            1789878, // Liverpool
            512991, // Mackay
            251, // Macquarie Park
            253, // Mascot
            228330, // Melbourne CBD
            194183, // Mulgrave
            192117, // Newcastle
        ]
        _writeResponseJson(response, getCustomersByFilters(NS_MODULES, [
            ['entitystatus', 'is', 13],
            'AND',
            ['partner', 'noneof', franchiseesToExclude],
            'AND',
            ['partner', 'isNotEmpty'.toLowerCase(), ''],
            'AND',
            ['partner.entityid', 'doesNotContain'.toLowerCase(), 'TEST']
        ], ['entityid', 'companyname', 'partner'], true));
    },
    'getInvoicesByCustomerId' : function (response, {customerId}) {
        _writeResponseJson(response, getInvoicesByFilters(NS_MODULES, [
            ["type", "anyof", "CustInvc"],
            'AND', ["mainline", "is", "T"],
            'AND', ['entity', 'is', customerId],
        ]))
    },
    'getEligibleInvoicesByFranchiseeId' : function (response, {franchiseeId}) {
        _writeResponseJson(response, getInvoicesByFilters(NS_MODULES, [
            ['type', 'is', 'CustInvc'],
            'AND', ['customer.partner', 'is', franchiseeId],
            'AND', ['customer.status', 'is', 13], // Signed (13)
            'AND', ['mainline', 'is', true],
            'AND', ['memorized', 'is', false],
            'AND', [['trandate', 'within', 'oneyearbeforelast'],'OR',['trandate','within','monthsago6','daysago0']],
            "AND", [["customer.custentity_date_of_last_price_increase", "isempty", ""],"OR",["customer.custentity_date_of_last_price_increase", "onorbefore", "lastyeartodate"]]
        ], ['trandate', 'customer.internalid', 'customer.entityid', 'customer.companyname'], true))
    },
    'getEligibleInvoicesByFranchiseeIdWithinPeriods' : function (response, {franchiseeId, start, end}) {
        _writeResponseJson(response, getInvoicesByFilters(NS_MODULES, [
            ['type', 'is', 'CustInvc'],
            'AND', ['customer.partner', 'is', franchiseeId],
            'AND', ['customer.status', 'is', 13], // Signed (13)
            'AND', ['mainline', 'is', true],
            'AND', ['memorized', 'is', false],
            'AND', ['trandate','within', start, end],
        ], ['trandate', 'customer.internalid', 'customer.entityid', 'customer.companyname'], true))
    },
    'getActiveServicesByCustomerId' : function (response, {customerId}) {
        _writeResponseJson(response, getServicesByFilters(NS_MODULES, [
            ['isinactive', 'is', false],
            'AND',
            ['custrecord_service_category', 'is', 1], // We take records under the Category: Services (1) only
            'AND',
            ['custrecord_service_customer', 'is', customerId]
        ]))
    },
    'getFinancialItemsByCustomerId' : function (response, {customerId}) {
        const financialItems = [];
        const sublistId = 'itemPricing'.toLowerCase();
        const customerRecord = NS_MODULES.record.load({type: 'customer', id: customerId, isDynamic: true});
        const lineCount = customerRecord['getLineCount']({sublistId});
        const fieldsToGet = ['item', 'level', 'price'];

        for (let line = 0; line < lineCount; line++) {
            let entry = {};

            for (let fieldId of fieldsToGet) {
                entry[fieldId] = customerRecord["getSublistValue"]({ sublistId, fieldId, line });
                entry[fieldId + '_text'] = customerRecord["getSublistText"]({ sublistId, fieldId, line });
            }

            financialItems.push(entry);
        }

        _writeResponseJson(response, financialItems);
    },
    'getItemsOfInvoiceById' : function (response, {invoiceId}) {
        const items = [];
        const linesToExclude = [
            'Signature Item Collected',
            'Parcel Collection',
            'Weight Charges',
            'Account Admin Fee',
            'Fuel Surcharge',
            'Credit Card Surcharge',
            'MP Products',
            'COGS (Non GST)',
            'Waiting Time'
        ]
        const invoiceRecord = NS_MODULES.record.load({type: 'invoice', id: invoiceId, isDynamic: true});
        const lineCount = invoiceRecord['getLineCount']({sublistId: 'item'});
        const fieldsToGet = ['item', 'rate', 'amount', 'quantity'];

        for (let line = 0; line < lineCount; line++) {
            let entry = {};

            for (let fieldId of fieldsToGet) {
                entry[fieldId] = invoiceRecord["getSublistValue"]({ sublistId: "item", fieldId, line });
                entry[fieldId + '_text'] = invoiceRecord["getSublistText"]({ sublistId: "item", fieldId, line });
            }

            if (!linesToExclude.includes(entry['item_text'])) items.push(entry);
        }

        _writeResponseJson(response, items);
    },
    'getActiveServicesByFranchiseeId' : function (response, {franchiseeId}) {
        _writeResponseJson(response, getServicesByFilters(NS_MODULES, [
            ['custrecord_service_franchisee', 'anyof', franchiseeId],
            'AND',
            ['custrecord_service_customer.status' ,'anyof', '13'],
            'AND',
            ['isinactive', 'is', 'F'],
            'AND',
            ['custrecord_service_category', 'anyof', '1'],
            'AND',
            [
                ["custrecord_service_customer.custentity_date_of_last_price_increase","isempty",""],
                "OR",
                ["custrecord_service_customer.custentity_date_of_last_price_increase","onorbefore","lastyeartodate"]
            ],
        ], [
            'custrecord_service_franchisee',
            'custrecord_service',
            'custrecord_service_category',
            'custrecord_service_price',
            'CUSTRECORD_SERVICE_CUSTOMER.companyname',
            'CUSTRECORD_SERVICE_CUSTOMER.entityid',
            'CUSTRECORD_SERVICE_CUSTOMER.internalid',
            'CUSTRECORD_SERVICE_CUSTOMER.custentity_date_of_last_price_increase'
        ], true));
    },
    'getPriceAdjustmentRuleById' : function(response, {priceAdjustmentRuleId}) {
        let priceAdjustmentRule = NS_MODULES.record.load({type: 'customrecord_price_adjustment_rules', id: priceAdjustmentRuleId});
        let data = {};

        data['id'] = priceAdjustmentRule['getValue']({fieldId: 'id'});
        for (let fieldId in pricingRuleFields) {
            data[fieldId] = priceAdjustmentRule['getValue']({fieldId});
            data[fieldId + '_text'] = priceAdjustmentRule['getText']({fieldId});
        }

        _writeResponseJson(response, data);

    },
    'getAllPriceAdjustmentRules' : function(response) {
        _writeResponseJson(response, getPriceAdjustmentRulesByFilters(NS_MODULES, []));
    },
    'getPriceAdjustmentOfFranchisee' : function (response, {priceAdjustmentRuleId, franchiseeId}) {
        _writeResponseJson(response, getPriceAdjustmentOfFranchiseeByFilter(NS_MODULES, [
            ['custrecord_1302_master_record', 'is', priceAdjustmentRuleId],
            'AND',
            ['custrecord_1302_franchisee', 'is', franchiseeId]
        ]))
    },
    'getSelectOptions' : function (response, {id, type, valueColumnName, textColumnName}) {
        let {search} = NS_MODULES;
        let data = [];

        search.create({
            id, type,
            filters: ['isinactive', 'is', false],
            columns: [{name: valueColumnName}, {name: textColumnName}]
        }).run().each(result => {
            data.push({value: result['getValue'](valueColumnName), title: result['getValue'](textColumnName)});
            return true;
        });

        _writeResponseJson(response, data);
    },
    'getServiceTypes' : function (response) {
        let {search} = NS_MODULES;
        let data = [];

        let searchResult = search.create({
            type: 'customrecord_service_type',
            filters: [
                {name: 'custrecord_service_type_category', operator: 'anyof', values: [1]},
            ],
            columns: [
                {name: 'internalid'},
                {name: 'custrecord_service_type_ns_item_array'},
                {name: 'name'}
            ]
        }).run();

        searchResult.each(item => {
            data.push({value: item['getValue']('internalid'), title: item['getValue']('name')})

            return true;
        });

        _writeResponseJson(response, data);
    },
}

const postOperations = {
    'saveOrCreatePriceAdjustmentRule' : function(response, {priceAdjustmentRuleId, priceIncreaseRuleData}) {
        let priceAdjustmentRule = priceAdjustmentRuleId ?
            NS_MODULES.record.load({type: 'customrecord_price_adjustment_rules', id: priceAdjustmentRuleId}) :
            NS_MODULES.record.create({type: 'customrecord_price_adjustment_rules'});

        for (let fieldId in priceIncreaseRuleData) {
            let value = priceIncreaseRuleData[fieldId];
            if (isoStringRegex.test(priceIncreaseRuleData[fieldId]) && ['date', 'datetimetz'].includes(priceAdjustmentRule['getField']({fieldId})?.type))
                value = new Date(priceIncreaseRuleData[fieldId]);

            priceAdjustmentRule.setValue({fieldId, value});
        }

        _writeResponseJson(response, {priceAdjustmentRuleId: priceAdjustmentRule.save({ignoreMandatoryFields: true})});
    },
    'saveOrCreatePriceAdjustmentRecord' : function(response, {priceAdjustmentRecordId, priceAdjustmentData}) {
        let priceAdjustmentRecord = priceAdjustmentRecordId ?
            NS_MODULES.record.load({type: 'customrecord_price_adjustment_franchisee', id: priceAdjustmentRecordId}) :
            NS_MODULES.record.create({type: 'customrecord_price_adjustment_franchisee'});

        for (let fieldId in priceAdjustmentData) {
            let value = priceAdjustmentData[fieldId];
            if (isoStringRegex.test(priceAdjustmentData[fieldId]) && ['date', 'datetimetz'].includes(priceAdjustmentRecord['getField']({fieldId})?.type))
                value = new Date(priceAdjustmentData[fieldId]);

            priceAdjustmentRecord.setValue({fieldId, value});
        }

        _writeResponseJson(response, {priceAdjustmentRecordId: priceAdjustmentRecord.save({ignoreMandatoryFields: true})});
    }
    },
    'cancelPriceAdjustmentRecord' : function(response, {priceAdjustmentRecordId, franchiseeId}) {
        const franchiseeRecord = NS_MODULES.record.load({type: 'partner', id: franchiseeId});
        const franchiseeName = franchiseeRecord.getValue({fieldId: 'companyname'});
        const priceAdjustmentRecord = NS_MODULES.search['lookupFields']({
            type: 'customrecord_price_adjustment_franchisee', id: priceAdjustmentRecordId,
            columns: 'custrecord_1302_master_record.custrecord_1301_effective_date'});

        let effectiveDate = priceAdjustmentRecord['custrecord_1302_master_record.custrecord_1301_effective_date'];
        effectiveDate = effectiveDate.substring(0, effectiveDate.indexOf(' '))

        NS_MODULES.record['submitFields']({
            type: 'customrecord_price_adjustment_franchisee', id: priceAdjustmentRecordId,
            values: { custrecord_1302_cancelled: true, }
        });

        NS_MODULES.email.send({
            author: 112209,
            subject: `${franchiseeName} opted out of Price Increase`,
            body: `Franchisee ${franchiseeName} has decided to opt out of this Price Increase period which has effective date on ${effectiveDate}`,
            recipients: [
                import.meta.env.VITE_NS_USER_1732844_EMAIL,
            ],
            isInternalOnly: true
        })

        _writeResponseJson(response, 'Record cancelled');
    },
};