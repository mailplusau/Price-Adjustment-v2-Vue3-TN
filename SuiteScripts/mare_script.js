/**
 * @author Tim Nguyen
 * @description NetSuite Experimentation - Price Adjustment Processor.
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @created 11/09/2024
 */

import { writeXLSX, utils } from 'xlsx';
import {
    _readFromDataCells,
    getPriceAdjustmentOfFranchiseeByFilter,
    getPriceAdjustmentRulesByFilters, getServicesByFilters,
} from "netsuite-shared-modules";

let NS_MODULES = {};

const moduleNames = ['render', 'file', 'runtime', 'search', 'record', 'url', 'format', 'email', 'task', 'log', 'https'];

// eslint-disable-next-line no-undef
define(moduleNames.map(item => 'N/' + item), (...args) => {
    for (let [index, moduleName] of moduleNames.entries())
        NS_MODULES[moduleName] = args[index];

    function getInputData() { // Processor should run at early hour of the day
        const mapStageTasks = {};

        const priceAdjustmentSessionsToNotify = getPriceAdjustmentRulesByFilters(NS_MODULES, [
            // ['internalid', 'is', 5],
            ['custrecord_1301_effective_date', 'on', 'daysFromNow15'.toLowerCase()],
            'AND',
            ['custrecord_1301_notification_date', 'isEmpty'.toLowerCase(), ''],
            'AND',
            ['custrecord_1301_completion_date', 'isEmpty'.toLowerCase(), '']
        ]);

        const priceAdjustmentSessionsToProcess = getPriceAdjustmentRulesByFilters(NS_MODULES, [
            ['internalid', 'is', 5],
            // ['custrecord_1301_effective_date', 'on', 'today'.toLowerCase()],
            // 'AND',
            // ['custrecord_1301_notification_date', 'isNotEmpty'.toLowerCase(), ''],
            // 'AND',
            // ['custrecord_1301_completion_date', 'isEmpty'.toLowerCase(), '']
        ]);

        priceAdjustmentSessionsToNotify.forEach(priceAdjustmentSession => { // with 100 franchisees, this could reach 1000 governance
            const priceAdjustmentRecords = getPriceAdjustmentOfFranchiseeByFilter(NS_MODULES, [
                ['custrecord_1302_master_record', 'is', priceAdjustmentSession['internalid']]
            ])

            priceAdjustmentRecords.forEach(priceAdjustmentRecord => {
                const adjustmentData = _readFromDataCells(priceAdjustmentRecord, 'custrecord_1302_data_');

                const uniqueCustomerIds = [...(new Set(adjustmentData.map(item => parseInt(item['CUSTRECORD_SERVICE_CUSTOMER.internalid']))))];

                for (let customerId of uniqueCustomerIds) {
                    const adjustedServices = adjustmentData
                        .filter(item => parseInt(item['CUSTRECORD_SERVICE_CUSTOMER.internalid']) === customerId && item['adjustment'] !== 0 && item['confirmed']);

                    if (!adjustedServices.length) continue;

                    mapStageTasks['CheckCustomerToNotify_' + customerId] = {
                        customerId,
                        franchiseeId: priceAdjustmentRecord['custrecord_1302_franchisee'],
                        adjustedServices
                    }

                }
            })
        })

        priceAdjustmentSessionsToProcess.forEach(priceAdjustmentSession => {
            const priceAdjustmentRecords = getPriceAdjustmentOfFranchiseeByFilter(NS_MODULES, [
                ['custrecord_1302_master_record', 'is', priceAdjustmentSession['internalid']]
            ])

            priceAdjustmentRecords.forEach(priceAdjustmentRecord => {
                const adjustmentData = _readFromDataCells(priceAdjustmentRecord, 'custrecord_1302_data_');

                const uniqueCustomerIds = [...(new Set(adjustmentData.map(item => parseInt(item['CUSTRECORD_SERVICE_CUSTOMER.internalid']))))];

                for (let customerId of uniqueCustomerIds) {
                    const adjustedServices = adjustmentData
                        .filter(item => parseInt(item['CUSTRECORD_SERVICE_CUSTOMER.internalid']) === customerId && item['adjustment'] !== 0 && item['confirmed']);

                    if (!adjustedServices.length) continue;

                    mapStageTasks['CheckCustomerToProcess_' + customerId] = {
                        customerId,
                        franchiseeId: priceAdjustmentRecord['custrecord_1302_franchisee'],
                        adjustedServices
                    }

                }
            })
        })

        return mapStageTasks;
    }

    function map(context) {
        const value = JSON.parse(context.value);

        NS_MODULES.log.debug('map', `key: ${context.key} | values: ${context.value}`)

        // check if the customer should be notified
        if (context.key.includes('CheckCustomerToNotify') || context.key.includes('CheckCustomerToProcess')) {
            const customerId = value['customerId'];
            const activeServices = getServicesByFilters(NS_MODULES, [
                ['isinactive', 'is', false],
                'AND', ['custrecord_service_category', 'is', 1], // We take records under the Category: Services (1) only
                'AND', ['custrecord_service_customer', 'is', customerId]
            ]);
            const activeServiceIds = activeServices.map(item => item['internalid']);
            const adjustedServices = value['adjustedServices']
                .filter(item => activeServiceIds.includes(item['internalid']) && item['adjustment'] !== 0 && item['confirmed']);

            context.write({
                key: (context.key.includes('CheckCustomerToProcess') ? 'ProcessCustomer_' : 'NotifyCustomer_') + customerId,
                value: {
                    customerId,
                    franchiseeId: value['franchiseeId'],
                    adjustedServices: adjustedServices
                        .map(service => ({
                            serviceId: service['internalid'],
                            serviceType: service['custrecord_service_text'],
                            servicePrice: service['custrecord_service_price'],
                            adjustment: service['adjustment']
                        }))
                }
            });
        }
    }

    function reduce(context) {
        NS_MODULES.log.debug('reduce', `key: ${context.key} | values: ${context.values}`)
        try {
            const value = JSON.parse(context.values);

            if (context.key.includes('NotifyCustomer')) { // TODO: send email here
                _.sendPriceAdjustmentNotificationEmail(context, value['customerId']);
            } else if  (context.key.includes('ProcessCustomer')) { // TODO: process price adjustment here
                _.processPriceAdjustment(context, value['customerId'], value['franchiseeId'], value['adjustedServices'])
            }
        } catch (e) {
            context.write({ key: 'FAILED_' + context.key, value: e });
        }
    }

    function summarize(context) {
        _.handleErrorIfAny(context);
        _.generateReport(context);
        NS_MODULES.log.debug('summarize', 'done')
    }

    return {
        getInputData,
        map,
        reduce,
        summarize
    };
});

const _ = {
    sendPriceAdjustmentNotificationEmail(context, customerId) {
        NS_MODULES.log.debug('sendPriceAdjustmentNotificationEmail', `customerId: ${customerId}`)
        context.write({ key: 'NotifiedCustomer_' + customerId, value: {
                customerId,
            }
        });
    },
    processPriceAdjustment(context, customerId, franchiseeId, adjustedServices = []) {
        // ON Effective date:
        // - create commencement register, Sales Type: Price Increase, set it to Signed. Set previous Comm Regs to Changed
        // - (does it need T&C agreement???)
        // - create service changes, set them to Active
        // - apply changes to affected services, set previous service changes to Ceased

        NS_MODULES.log.debug('processPriceAdjustment', `customerId: ${customerId} | adjustedServices: ${adjustedServices}`)

        context.write({ key: 'ProcessedCustomer_' + customerId, value: {
                customerId,
                franchiseeId,
                adjustedServices
            }
        });
    },

    generateReport(summaryContext) {
        NS_MODULES.log.debug('generateReport', `sending report`)
        const headers = ['Customer ID', 'Franchisee ID', 'Service ID', 'Service Price', 'Adjustment', 'New Price'];
        const rowItem = { customerId: '', franchiseeId: '',  serviceId: '', servicePrice: '', adjustment: '', newPrice: ''}
        const rows = [];

        summaryContext.output.iterator().each(function(key, value) {
            if (`${key}`.includes('ProcessedCustomer')) {
                const {customerId, franchiseeId, adjustedServices} = JSON.parse(`${value}`);

                for (let service of adjustedServices) {
                    rows.push({
                        ...rowItem,

                        customerId, franchiseeId,
                        serviceId: service['serviceId'],
                        servicePrice: parseFloat(service['servicePrice']),
                        adjustment: parseFloat(service['adjustment']),
                        newPrice: parseFloat(service['servicePrice']) + parseFloat(service['adjustment'])
                    })
                }
            }

            return true;
        });

        const workbook = utils.book_new();
        const worksheet = utils.json_to_sheet(rows);

        utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });
        utils.sheet_add_json(worksheet, rows, { origin: 'A2', skipHeader: true });
        utils.book_append_sheet(workbook, worksheet, "Dates");

        const xlsxFile = writeXLSX(workbook, { type: 'base64' });

        let attachmentFile = NS_MODULES.file.create({
            name: 'price_increase_report.xlsx',
            fileType: NS_MODULES.file.Type['EXCEL'],
            contents: xlsxFile,
        });

        NS_MODULES.email.send({
            author: 112209,
            subject: 'Price Increase Report',
            body: 'Please see attachemnt',
            recipients: ['tim.nguyen@mailplus.com.au'],
            attachments: [attachmentFile],
            isInternalOnly: true
        });
    },
    handleErrorIfAny(summary) {
        let inputSummary = summary['inputSummary'];
        let mapSummary = summary['mapSummary'];
        let reduceSummary = summary['reduceSummary'];

        if (inputSummary.error)
            NS_MODULES.log.debug('INPUT_STAGE_FAILED', `${inputSummary.error}`)

        mapSummary.errors.iterator().each(function(key, value){
            NS_MODULES.log.debug(`MAP_STAGE_KEY_${key}_FAILED`, `Error was: ${JSON.parse(value + '').message}`)
            return true;
        });

        reduceSummary.errors.iterator().each(function(key, value){
            NS_MODULES.log.debug(`REDUCE_STAGE_KEY_${key}_FAILED`, `Error was: ${JSON.parse(value + '').message}`)
            return true;
        });
    }
}