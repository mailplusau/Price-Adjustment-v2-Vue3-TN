/**
 * @author Tim Nguyen
 * @description NetSuite Experimentation - Price Adjustment Processor.
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @created 11/09/2024
 *
 * Should be scheduled to run at 2AM AEST every day.
 */

import { writeXLSX, utils } from 'xlsx';
import {
    readFromDataCells,
    getPriceAdjustmentOfFranchiseeByFilter,
    getPriceAdjustmentRulesByFilters,
    getServicesByFilters,
    getCommRegsByFilters,
    getServiceChangesByFilters,
    SERVICE_CHANGE_STATUS, COMM_REG_STATUS, getCustomerAddresses, getFranchiseesByFilters,
} from "netsuite-shared-modules";
import { formatPrice, getSessionStatusFromAdjustmentRecord } from "@/utils/utils.mjs";

let NS_MODULES = {};

const moduleNames = ['render', 'file', 'runtime', 'search', 'record', 'url', 'format', 'email', 'task', 'log', 'https'];

// eslint-disable-next-line no-undef
define(moduleNames.map(item => 'N/' + item), (...args) => {
    for (let [index, moduleName] of moduleNames.entries())
        NS_MODULES[moduleName] = args[index];

    function getInputData() { // Processor should run at early hour of the day
        const mapStageTasks = {};

        const priceAdjustmentSessionsToNotify = getPriceAdjustmentRulesByFilters(NS_MODULES, [
            ['custrecord_1301_effective_date', 'on', 'daysFromNow14'.toLowerCase()],
            'AND',
            ['custrecord_1301_notification_date', 'isEmpty'.toLowerCase(), ''],
            'AND',
            ['custrecord_1301_completion_date', 'isEmpty'.toLowerCase(), '']
        ]);

        const priceAdjustmentSessionsToProcess = getPriceAdjustmentRulesByFilters(NS_MODULES, [
            ['custrecord_1301_effective_date', 'on', 'today'.toLowerCase()],
            'AND',
            ['custrecord_1301_notification_date', 'isNotEmpty'.toLowerCase(), ''],
            'AND',
            ['custrecord_1301_completion_date', 'isEmpty'.toLowerCase(), '']
        ]);

        const prepareTask = (priceAdjustmentSession, taskIdPrefix) => {
            const priceAdjustmentRecords = getPriceAdjustmentOfFranchiseeByFilter(NS_MODULES, [
                ['custrecord_1302_master_record', 'is', priceAdjustmentSession['internalid']],
                'AND',
                ['custrecord_1302_opt_out_reason', 'isEmpty'.toLowerCase(), ''],
            ])

            priceAdjustmentRecords.forEach(priceAdjustmentRecord => {
                const adjustmentData = readFromDataCells(priceAdjustmentRecord, 'custrecord_1302_data_') || [];

                const uniqueCustomerIds = [...(new Set(adjustmentData.map(item => parseInt(item['CUSTRECORD_SERVICE_CUSTOMER.internalid']))))];

                for (let customerId of uniqueCustomerIds) {
                    const adjustedServices = adjustmentData
                        .filter(item => parseInt(item['CUSTRECORD_SERVICE_CUSTOMER.internalid']) === customerId);

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
        });

        priceAdjustmentSessionsToProcess.forEach(priceAdjustmentSession => {
            prepareTask(priceAdjustmentSession, 'CheckCustomerToProcess');
        });

        NS_MODULES.log.debug('getInputData', `today: ${_.getToday()} | mapStageTasks: ${JSON.stringify(mapStageTasks)}`);

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
                .filter(item => activeServiceIds.includes(item['internalid']));

            context.write({
                key: (context.key.includes('CheckCustomerToProcess') ? 'ProcessCustomer_' : 'NotifyCustomer_') + customerId,
                value: {
                    ...value,
                    adjustedServices: adjustedServices
                        .map(service => {
                            // search for the service in array of active services and extract its frequency.
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
                                confirmed: service['confirmed'],
                                frequency, // for use when creating service change records
                            }
                        })
                }
            });
        } else context.write({key: context.key, value: context.value});
    }

    function reduce(context) {
        NS_MODULES.log.debug('reduce', `key: ${context.key} | values: ${context.values}`);

        const value = JSON.parse(context.values);

        const judgementDay = 15;
        const today = _.getToday();
        const shouldUpdateFinancialItems = today.getDate() >= judgementDay;

        if (context.key.includes('NotifyCustomer')) { // send email here
            _.sendPriceAdjustmentNotificationEmail(value['sessionId'], value['customerId'], value['adjustedServices']);

            context.write({ key: 'NotifiedCustomer_' + value['customerId'], value });
        } else if  (context.key.includes('ProcessCustomer')) { // process price adjustment here
            _.processPriceAdjustmentE2E(value['sessionId'], value['customerId'], value['franchiseeId'], value['adjustedServices']);

            if (shouldUpdateFinancialItems && value['adjustedServices'].filter(item => item['adjustment'] !== 0 && item['confirmed']).length)
                _.updateFinancialItemsOfCustomer(value['customerId']);

            context.write({ key: 'ProcessedCustomer_' + value['customerId'], value });
        } else context.write({key: context.key, value: context.value});
    }

    function summarize(context) {
        _.handleErrorIfAny(context);

        _.generateReport(context);
        _.generateMondayReport();
        _.finalisePriceAdjustmentProcess(context);
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
    sendPriceAdjustmentNotificationEmail(sessionId, customerId, adjustedServices) {
        NS_MODULES.log.debug('sendPriceAdjustmentNotificationEmail', `customerId: ${customerId}`);

        adjustedServices = adjustedServices.filter(item => item['adjustment'] !== 0 && item['confirmed']);

        if (!adjustedServices.length) return;

        const customerInfo = NS_MODULES.search['lookupFields']({
            type: 'customer', id: customerId,
            columns: ['email', 'custentity_email_service', 'custentity_accounts_cc_email']});

        const pricingRuleRecord = NS_MODULES.search['lookupFields']({
            type: 'customrecord_price_adjustment_rules', id: sessionId,
            columns: 'custrecord_1301_effective_date'});

        let effectiveDate = pricingRuleRecord['custrecord_1301_effective_date'];
        effectiveDate = effectiveDate.substring(0, effectiveDate.indexOf(' '))

        const addresses = getCustomerAddresses(NS_MODULES, customerId);
        let billingAddress = addresses.filter(address => address['defaultbilling'])[0];
        if (!billingAddress) billingAddress = addresses.filter(address => address['defaultshipping'])[0];
        if (!billingAddress) billingAddress = addresses.filter(address => address['isresidential'])[0];
        if (!billingAddress) billingAddress = addresses[0];
        if (!billingAddress) throw `Customer ID ${customerId} has no valid address`;

        let mergeResult = NS_MODULES.render['mergeEmail']({
            templateId: 473,
            entity: {type: 'customer', id: parseInt(customerId)}
        });
        let emailSubject = mergeResult.subject;
        let emailBody = mergeResult.body;

        let serviceTableHtml = '<table width="500" border="1"><thead><tr><th>SERVICE</th><th>AMOUNT OF INCREASE(Exc. GST)</th></tr></thead><tbody>';
        serviceTableHtml += adjustedServices.map(service => `<tr><th>${service['serviceName']}</th><th>${formatPrice(service['adjustment']).replace('A', '')}</th></tr>`).join('');
        serviceTableHtml += '</tbody></table>';

        emailBody = emailBody.replace(/&{serviceTable}/gi, serviceTableHtml);
        emailBody = emailBody.replace(/&{headerDate}/gi, this.getTodayDate());
        emailBody = emailBody.replace(/&{addrUnit}/gi, billingAddress['addr1']);
        emailBody = emailBody.replace(/&{addrStreet}/gi, billingAddress['addr2']);
        emailBody = emailBody.replace(/&{addrCity}/gi, billingAddress['city']);
        emailBody = emailBody.replace(/&{addrState}/gi, billingAddress['state']);
        emailBody = emailBody.replace(/&{addrPostcode}/gi, billingAddress['zip']);
        emailBody = emailBody.replace(/&{dateEffective}/gi, effectiveDate);

        NS_MODULES.email.send({
            author: 35031, // accounts@mailplus.com.au
            subject: emailSubject,
            body: emailBody,
            recipients: [
                customerInfo['email'],
                customerInfo['custentity_email_service'],
                customerInfo['custentity_accounts_cc_email'],
            ],
            relatedRecords: { 'entityId': customerId },
            isInternalOnly: true
        })

        NS_MODULES.log.debug('sendPriceAdjustmentNotificationEmail', `notice sent to ${customerInfo['email']} and ${customerInfo['custentity_email_service']}`)
    },
    processPriceAdjustmentE2E(sessionId, customerId, franchiseeId, adjustedServices = []) {
        // ON Effective date:
        // - create commencement register, Sales Type: Price Increase, set it to Signed. Set previous Comm Regs to Changed
        // - (does it need T&C agreement???)
        // - create service changes, set them to Active
        // - apply changes to affected services, set previous service changes to Ceased

        NS_MODULES.log.debug('processPriceAdjustmentE2E', `sessionId: ${sessionId} | franchiseeId: ${franchiseeId} | customerId: ${customerId} | adjustedServices: ${JSON.stringify(adjustedServices)}`);

        adjustedServices = adjustedServices.filter(item => item['adjustment'] !== 0 && item['confirmed']);

        if (!adjustedServices.length) return;

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

    generateMondayReport() {
        if (_.getToday().getDay() !== 1) return;

        let hasData = false;
        const workbook = utils.book_new();
        const headers = ['Franchisee ID', 'Franchisee Name', 'Session Status'];
        const allFranchisees = getFranchiseesByFilters(NS_MODULES, [
            ['isInactive'.toLowerCase(), 'is', false]
        ]);

        getPriceAdjustmentRulesByFilters(NS_MODULES, [
            ['custrecord_1301_deadline', 'onOrAfter'.toLowerCase(), 'today'],
            'AND',
            ['custrecord_1301_opening_date', 'onOrBefore'.toLowerCase(), 'today'],
            'AND',
            ['custrecord_1301_completion_date', 'isEmpty'.toLowerCase(), '']
        ]).forEach(priceAdjustmentSession => {
            hasData = true;
            let effectiveDate = priceAdjustmentSession['custrecord_1301_effective_date'];
            effectiveDate = effectiveDate.substring(0, effectiveDate.indexOf(' ')).replace(/\//gi, '.');

            const priceAdjustmentRecords = getPriceAdjustmentOfFranchiseeByFilter(NS_MODULES, [
                ['custrecord_1302_master_record', 'is', priceAdjustmentSession['internalid']],
            ])

            const rows = [];

            allFranchisees.forEach(franchisee => {
                const excludeList = [0];
                if (/^old /gi.test(franchisee['companyname'])) return;
                if (/^test/gi.test(franchisee['companyname'])) return;
                if (excludeList.includes(parseInt(franchisee['internalid']))) return;

                const index = priceAdjustmentRecords.findIndex(item => item['custrecord_1302_franchisee'] === franchisee['internalid']);
                rows.push({
                    franchiseeId: franchisee['internalid'],
                    franchiseeName: franchisee['companyname'],
                    sessionStatus: getSessionStatusFromAdjustmentRecord(priceAdjustmentRecords[index]).status
                })
            })

            const worksheet = utils.json_to_sheet(rows);

            utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });
            utils.sheet_add_json(worksheet, rows, { origin: 'A2', skipHeader: true });
            utils.book_append_sheet(workbook, worksheet, `EDate ${effectiveDate}`);
        });

        if (!hasData) return NS_MODULES.log.debug('generateMondayReport', 'Nothing to report');

        const xlsxFile = writeXLSX(workbook, { type: 'base64' });

        let today = this.getToday();
        let attachmentFile = NS_MODULES.file.create({
            name: `weekly_price_increase_activity_report_${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}.xlsx`,
            fileType: NS_MODULES.file.Type['EXCEL'],
            contents: xlsxFile,
        });

        NS_MODULES.email.send({
            author: 112209,
            subject: 'Weekly Price Increase Activity Report',
            body: 'Please see the attached spreadsheet for franchisees\' activities within this Price Increase Period as of today.',
            recipients: [
                import.meta.env.VITE_NS_USER_1732844_EMAIL,
                import.meta.env.VITE_NS_USER_409635_EMAIL,
                import.meta.env.VITE_NS_USER_772595_EMAIL,
                import.meta.env.VITE_NS_USER_280700_EMAIL,
                import.meta.env.VITE_NS_USER_187729_EMAIL,
            ],
            attachments: [attachmentFile],
            isInternalOnly: true
        });

        NS_MODULES.log.debug('generateMondayReport', 'Monday report sent');
    },
    generateReport(summaryContext) {
        const sessions = {};
        const headers = ['Entity ID', 'Customer ID', 'Customer Name', 'Franchisee ID', 'Franchisee Name',
            'Service ID', 'Service Name', 'Service Price', 'Adjustment', 'New Price', 'Status'];

        summaryContext.output.iterator().each(function(key, value) {
            if (`${key}`.includes('ProcessedCustomer')) {
                const {sessionId, customerId, franchiseeId, franchiseeName, adjustedServices, entityId, customerName} = JSON.parse(`${value}`);

                if (!sessions[sessionId]) {
                    const priceAdjustmentSession = NS_MODULES.record.load({type: 'customrecord_price_adjustment_rules', id: sessionId});
                    let effectiveDate = priceAdjustmentSession.getText({fieldId: 'custrecord_1301_effective_date'});
                    sessions[sessionId]['effectiveDate'] = effectiveDate.substring(0, effectiveDate.indexOf(' '));
                    sessions[sessionId]['rows'] = [];
                }

                for (let service of adjustedServices) {
                    const conditionSwitch = (service['adjustment'] !== 0 ? 1 : 0) + (service['confirmed'] ? 10 : 0);
                    const lookupTable = {
                        0: 'Not confirmed',
                        1: 'Adjusted but not confirmed',
                        11: 'Confirmed and applied',
                        10: 'Confirmed without adjustment'
                    }

                    sessions[sessionId]['rows'].push({
                        entityId,
                        customerName,
                        customerId, franchiseeId,
                        franchiseeName,
                        serviceId: service['serviceId'],
                        serviceName: service['serviceName'],
                        servicePrice: parseFloat(service['servicePrice']),
                        adjustment: parseFloat(service['adjustment']),
                        newPrice: parseFloat(service['servicePrice']) + parseFloat(service['adjustment']),
                        status: lookupTable[conditionSwitch],
                    })
                }
            }

            return true;
        });

        if (!Object.keys(sessions).length) return; // cancel this if there are nothing to report

        NS_MODULES.log.debug('generateReport', `sending report`);

        const workbook = utils.book_new();

        for (let sessionId of Object.keys(sessions)) {
            const worksheet = utils.json_to_sheet(sessions[sessionId]['rows']);

            utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });
            utils.sheet_add_json(worksheet, sessions[sessionId]['rows'], { origin: 'A2', skipHeader: true });
            utils.book_append_sheet(workbook, worksheet, `${sessions[sessionId]['effectiveDate']} Price Increase`);
        }

        const xlsxFile = writeXLSX(workbook, { type: 'base64' });

        let today = this.getToday();
        let attachmentFile = NS_MODULES.file.create({
            name: `price_increase_report_${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}.xlsx`,
            fileType: NS_MODULES.file.Type['EXCEL'],
            contents: xlsxFile,
        });

        NS_MODULES.email.send({
            author: 112209,
            subject: `Final Price Increase Report for ${this.getTodayDate()}`,
            body: `Please see the attached spreadsheet for customers and franchisee affected by this Price Increase Period (effective date ${this.getTodayDate()})`,
            recipients: [
                import.meta.env.VITE_NS_USER_1732844_EMAIL,
                import.meta.env.VITE_NS_USER_409635_EMAIL,
                import.meta.env.VITE_NS_USER_772595_EMAIL,
                import.meta.env.VITE_NS_USER_280700_EMAIL,
                import.meta.env.VITE_NS_USER_187729_EMAIL,
            ],
            attachments: [attachmentFile],
            isInternalOnly: true
        });
    },
    finalisePriceAdjustmentProcess(summaryContext) {
        const processedSessionIds = [], notifiedSessionIds = [];
        summaryContext.output.iterator().each(function(key, value) {
            const { sessionId } = JSON.parse(`${value}`);

            if (sessionId && `${key}`.includes('ProcessedCustomer')) processedSessionIds.push(sessionId)
            if (sessionId && `${key}`.includes('NotifiedCustomer')) notifiedSessionIds.push(sessionId)
        });

        const uniqueProcessedSessionIds = [...(new Set(processedSessionIds))];
        const uniqueNotifiedSessionIds = [...(new Set(notifiedSessionIds))]

        for (let uniqueProcessedSessionId of uniqueProcessedSessionIds) {
            NS_MODULES.record['submitFields']({
                type: 'customrecord_price_adjustment_rules', id: uniqueProcessedSessionId,
                values: { custrecord_1301_completion_date: new Date(), }
            })
            NS_MODULES.log.debug("finalisePriceAdjustmentProcess", `Session #${uniqueProcessedSessionId} was processed.`);
        }

        for (let uniqueNotifiedSessionId of uniqueNotifiedSessionIds) {
            NS_MODULES.record['submitFields']({
                type: 'customrecord_price_adjustment_rules', id: uniqueNotifiedSessionId,
                values: { custrecord_1301_notification_date: new Date(), }
            })
            NS_MODULES.log.debug("finalisePriceAdjustmentProcess", `Session #${uniqueNotifiedSessionId} was notified.`);
        }
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
        date.setTime(date.getTime() + 12*60*60*1000); // forward 12 hours (AEST is about +10 or +11 UTC)

        return new Date(date.toISOString().replace('Z', ''));
    },
    getTodayDate() {
        let today = this.getToday();
        return `${today.getDate()}/${today.getMonth()+1}/${today.getFullYear()}`
    },
    getToday() {
        let today = new Date();
        today.setTime(today.getTime() + 18*60*60*1000); // forward 18 hours (AEST is about +10 or +11 UTC then add in 7 hours for US timezone)

        return today;
    },
}