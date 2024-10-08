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
    getPriceAdjustmentRulesByFilters,
    getServicesByFilters,
    getCommRegsByFilters,
    getServiceChangesByFilters,
    SERVICE_CHANGE_STATUS, COMM_REG_STATUS,
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
            // ['internalid', 'is', 6],
            ['custrecord_1301_effective_date', 'on', 'daysFromNow15'.toLowerCase()],
            'AND',
            ['custrecord_1301_notification_date', 'isEmpty'.toLowerCase(), ''],
            'AND',
            ['custrecord_1301_completion_date', 'isEmpty'.toLowerCase(), '']
        ]);

        const priceAdjustmentSessionsToProcess = getPriceAdjustmentRulesByFilters(NS_MODULES, [
            // ['internalid', 'is', 6],
            ['custrecord_1301_effective_date', 'on', 'today'.toLowerCase()],
            'AND',
            ['custrecord_1301_notification_date', 'isNotEmpty'.toLowerCase(), ''],
            'AND',
            ['custrecord_1301_completion_date', 'isEmpty'.toLowerCase(), '']
        ]);

        const prepareTask = (priceAdjustmentSession, taskIdPrefix) => {
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

                    mapStageTasks[taskIdPrefix + '_' + customerId] = {
                        sessionId: priceAdjustmentSession['internalid'],
                        customerId,
                        customerName: adjustedServices[0]['CUSTRECORD_SERVICE_CUSTOMER.companyname'],
                        customerEntityId: adjustedServices[0]['CUSTRECORD_SERVICE_CUSTOMER.entityid'],
                        franchiseeId: priceAdjustmentRecord['custrecord_1302_franchisee'],
                        franchiseeName: adjustedServices[0]['custrecord_service_franchisee_text'],
                        adjustedServices
                    }

                }
            })
        }

        priceAdjustmentSessionsToNotify.forEach(priceAdjustmentSession => { // with 100 franchisees, this could reach 1000 governance
            prepareTask(priceAdjustmentSession, 'CheckCustomerToNotify');
        })

        priceAdjustmentSessionsToProcess.forEach(priceAdjustmentSession => {
            prepareTask(priceAdjustmentSession, 'CheckCustomerToProcess');
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
                    ...value,
                    adjustedServices: adjustedServices
                        .map(service => {
                            // search for the service in array of active services and extra its frequency.
                            const index = activeServices.findIndex(item => item['internalid'] === service['internalid']);
                            const activeService = activeServices[index];
                            let frequency = activeService ?
                                ['mon', 'tue', 'wed', 'thu', 'fri', 'adhoc']
                                    .map((item, index) => activeService['custrecord_service_day_' + item] ? (index + 1) : 0)
                                    .filter(item => item) : [];

                            return {
                                serviceName: service['custrecord_service_text'],
                                serviceId: service['internalid'],
                                serviceType: service['custrecord_service_text'],
                                servicePrice: service['custrecord_service_price'],
                                adjustment: service['adjustment'],
                                frequency, // for use when creating search change records
                            }
                        })
                }
            });
        }
    }

    function reduce(context) {
        NS_MODULES.log.debug('reduce', `key: ${context.key} | values: ${context.values}`)
        try {
            const value = JSON.parse(context.values);

            if (context.key.includes('NotifyCustomer')) { // TODO: send email here
                _.sendPriceAdjustmentNotificationEmail(context, value['sessionId'], value['customerId']);

                context.write({ key: 'NotifiedCustomer_' + value['customerId'], value });
            } else if  (context.key.includes('ProcessCustomer')) { // TODO: process price adjustment here
                _.processPriceAdjustment(context, value['sessionId'], value['customerId'], value['franchiseeId'], value['adjustedServices']);
                _.updateFinancialItemsOfCustomer(value['customerId']);

                context.write({ key: 'ProcessedCustomer_' + value['customerId'], value });
            }
        } catch (e) { context.write({ key: 'FAILED_' + context.key, value: e }); }
    }

    function summarize(context) {
        _.handleErrorIfAny(context);
        _.generateReport(context);
        _.processPriceAdjustmentSessions(context);
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
    sendPriceAdjustmentNotificationEmail(context, sessionId, customerId) {
        NS_MODULES.log.debug('sendPriceAdjustmentNotificationEmail', `customerId: ${customerId}`)
    },
    processPriceAdjustment(context, sessionId, customerId, franchiseeId, adjustedServices = []) {
        // ON Effective date:
        // - create commencement register, Sales Type: Price Increase, set it to Signed. Set previous Comm Regs to Changed
        // - (does it need T&C agreement???)
        // - create service changes, set them to Active
        // - apply changes to affected services, set previous service changes to Ceased

        NS_MODULES.log.debug('processPriceAdjustment', `sessionId: ${sessionId} | franchiseeId: ${franchiseeId} | customerId: ${customerId} | adjustedServices: ${JSON.stringify(adjustedServices)}`);

        //if (sessionId) return;

        // Find all Signed comm reg of the customer that the new comm reg is associated to apply Changed (7) status to them
        getCommRegsByFilters(NS_MODULES, [
            ['custrecord_trial_status', 'anyof', COMM_REG_STATUS.Signed],
            'AND',
            ['custrecord_customer', 'is', customerId]
        ]).forEach(signedCommReg => {
            NS_MODULES.record['submitFields']({ // Make the current Active comm reg Changed (7)
                type: 'customrecord_commencement_register', id: signedCommReg['internalid'],
                values: { custrecord_trial_status: COMM_REG_STATUS.Changed, }
            });
        });

        for (let service of adjustedServices) {
            // Make all previously active service changes of affected service Ceased (3)
            getServiceChangesByFilters(NS_MODULES, [
                ['custrecord_servicechg_status', 'is', SERVICE_CHANGE_STATUS.Active], // Active (2)
                'AND',
                ['custrecord_servicechg_service', 'is', service['serviceId']]
            ]).forEach(activeServiceChange => {
                NS_MODULES.record['submitFields']({
                    type: 'customrecord_servicechg', id: activeServiceChange['internalid'],
                    values: { custrecord_servicechg_status: SERVICE_CHANGE_STATUS.Ceased, /* Ceased (3) */ }
                });
            });
        }

        // Create Commencement Register //
        const priceAdjustmentSession = NS_MODULES.record.load({type: 'customrecord_price_adjustment_rules', id: sessionId});
        const convertedEffectiveDate = this.convertDateTimeToDateField(priceAdjustmentSession.getValue({fieldId: 'custrecord_1301_effective_date'}));
        const franchiseeRecord = NS_MODULES.record.load({type: 'partner', id: franchiseeId});
        const commRegRecord = NS_MODULES.record.create({type: 'customrecord_commencement_register'});
        const commRegData = {
            custrecord_date_entry: convertedEffectiveDate,
            custrecord_comm_date: convertedEffectiveDate,
            custrecord_comm_date_signup: convertedEffectiveDate,
            custrecord_sale_type: '10', // Price Increase (10)
            custrecord_in_out: '2', // Inbound
            custrecord_customer: customerId,
            custrecord_salesrep: 109783,// an employee named Franchisees (to represent all franchisees)
            custrecord_franchisee: franchiseeId,
            custrecord_trial_status: COMM_REG_STATUS.Signed,
            custrecord_commreg_sales_record: null,
            custrecord_wkly_svcs: '5',
            custrecord_state: franchiseeRecord.getValue({fieldId: 'location'}),
        }

        for (let fieldId in commRegData)
            if (commRegRecord['getField']({fieldId}))
                commRegRecord.setValue({fieldId, value: commRegData[fieldId]});

        const commRegId = commRegRecord.save({ignoreMandatoryFields: true});

        // Create Service Changes and Update Services //
        for (let service of adjustedServices) {
            const serviceChangeData = {
                custrecord_servicechg_service: service['serviceId'], // Associated service
                custrecord_servicechg_status: SERVICE_CHANGE_STATUS.Active, // Status
                custrecord_servicechg_comm_reg: commRegId, // Associated comm reg
                custrecord_servicechg_type: 'Price Increase', // Service Change Type

                custrecord_servicechg_date_effective: convertedEffectiveDate, // Date - Effective

                custrecord_servicechg_old_price: service['servicePrice'], // Old Price
                custrecord_servicechg_old_freq: service['frequency'], // Old Frequency
                custrecord_servicechg_new_price: parseFloat(service['servicePrice']) + parseFloat(service['adjustment']), // New Price
                custrecord_servicechg_new_freq: service['frequency'], // New Frequency
            }

            const serviceChangeRecord = NS_MODULES.record.create({type: 'customrecord_servicechg', isDynamic: true});

            for (let fieldId in serviceChangeData)
                serviceChangeRecord.setValue({fieldId, value: serviceChangeData[fieldId]});

            serviceChangeRecord.save({ignoreMandatoryFields: true});

            // Update the associated service //
            NS_MODULES.record['submitFields']({
                type: 'customrecord_service', id: service['serviceId'],
                values: {
                    custrecord_service_price: serviceChangeData['custrecord_servicechg_new_price'],
                }
            });
        }

        // Finally, update Date Of Last Price Increase on customer record //
        NS_MODULES.record['submitFields']({
            type: 'customer', id: customerId,
            values: { custentity_date_of_last_price_increase: convertedEffectiveDate, }
        });
    },
    updateFinancialItemsOfCustomer(customerId) {
        NS_MODULES.log.debug('updateFinancialItemsOfCustomer', `customerId: ${customerId}`);

        //if (customerId) return;

        const sublistId = 'itemPricing'.toLowerCase();
        const customerRecord = NS_MODULES.record.load({type: 'customer', id: customerId, isDynamic: true});
        const report = {
            customer: {
                id: customerId,
                entityId: customerRecord.getValue({fieldId: 'entityId'.toLowerCase()}),
                companyName: customerRecord.getValue({fieldId: 'companyName'.toLowerCase()}),
            },
            services: []
        }

        // Wipe financial tab (going backward because line numbers are just array indexes)
        const lineCount = customerRecord['getLineCount']({sublistId});
        for (let line = lineCount - 1; line >= 0; line--) customerRecord['removeLine']({sublistId, line});

        // Re-populate financial tab using only active services
        getServicesByFilters(NS_MODULES, [
            ['isinactive', 'is', false],
            'AND',
            ['custrecord_service_category', 'is', 1], // We take records under the Category: Services (1) only
            'AND',
            ['custrecord_service_customer', 'is', customerId]
        ]).forEach(service => {
            customerRecord['selectNewLine']({sublistId});
            customerRecord['setCurrentSublistValue']({sublistId, fieldId: 'item', value: service['custrecord_service_ns_item']});
            customerRecord['setCurrentSublistValue']({sublistId, fieldId: 'level', value: -1});
            customerRecord['setCurrentSublistValue']({sublistId, fieldId: 'price', value: service['custrecord_service_price']});

            const freqShorthands = ['M', 'T', 'W', 'Th', 'F', 'Adhoc'];
            let freqArray = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Adhoc']
                .map((item, index) => service['custrecord_service_day_' + item.toLowerCase()] ? freqShorthands[index] : null)
                .filter(item => item);

            const freqString = freqArray.join('');

            report.services.push({
                name: service['custrecord_service_text'],
                price: service['custrecord_service_price'],
                frequency: freqArray.length ? (freqString === 'MTWThF' ? 'Daily' : freqString) : 'Adhoc'
            })

            customerRecord['commitLine']({sublistId});
        });

        // Save customer record
        customerRecord.save({ignoreMandatoryFields: true});
    },

    generateReport(summaryContext) {
        NS_MODULES.log.debug('generateReport', `sending report`)
        const headers = ['Entity ID', 'Customer ID', 'Customer Name', 'Franchisee ID', 'Franchisee Name', 'Service ID', 'Service Price', 'Adjustment', 'New Price'];
        const rowItem = { customerEntityId: '', customerId: '', customerName: '', franchiseeId: '', franchiseeName: '',  serviceId: '', servicePrice: '', adjustment: '', newPrice: ''}
        const rows = [];

        summaryContext.output.iterator().each(function(key, value) {
            if (`${key}`.includes('ProcessedCustomer')) {
                const {customerId, franchiseeId, franchiseeName, adjustedServices, customerEntityId, customerName} = JSON.parse(`${value}`);

                for (let service of adjustedServices) {
                    rows.push({
                        ...rowItem,

                        customerEntityId,
                        customerName,
                        customerId, franchiseeId,
                        franchiseeName,
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
    processPriceAdjustmentSessions(summaryContext) {
        const processedSessionIds = [], notifiedSessionIds = [];
        summaryContext.output.iterator().each(function(key, value) {
            const { sessionId } = JSON.parse(`${value}`);

            if (sessionId && `${key}`.includes('ProcessedCustomer')) processedSessionIds.push(sessionId)
            if (sessionId && `${key}`.includes('NotifiedCustomer')) notifiedSessionIds.push(sessionId)
        });

        const uniqueProcessedSessionIds = [...(new Set(processedSessionIds))];
        const uniqueNotifiedSessionIds = [...(new Set(notifiedSessionIds))]

        for (let uniqueProcessedSessionId of uniqueProcessedSessionIds)
            NS_MODULES.log.debug('processPriceAdjustmentSessions', `Session #${uniqueProcessedSessionId} was processed.`)

        for (let uniqueNotifiedSessionId of uniqueNotifiedSessionIds)
            NS_MODULES.log.debug('processPriceAdjustmentSessions', `Session #${uniqueNotifiedSessionId} was notified.`)
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
    },

    convertDateTimeToDateField(dateTimeObject) {
        if (Object.prototype.toString.call(dateTimeObject) !== '[object Date]')
            throw `Non-date object is given: ${dateTimeObject}`;

        let date = new Date(dateTimeObject.toISOString());
        date.setTime(date.getTime() + 11*60*60*1000); // forward 12 hours (AEST is about +10 or +11 UTC)

        return new Date(date.toISOString().replace('Z', ''));
    }
}