<script setup>
import { onMounted, ref } from "vue";
import { formatPrice } from "@/utils/utils.mjs";
import { readFromDataCells } from "netsuite-shared-modules";

const props = defineProps({
    historyEntry: {
        required: true,
    }
})

const sortedHistoryEntry = ref({});

onMounted(() => {
    const sortedData = {};
    const {referenceData, difference} = readFromDataCells(props.historyEntry, 'custrecord_1318_data_');

    for (let entry of difference) {
        const refData = getMatchingReferenceData(referenceData, entry);

        if (entry.type === 'CHANGE' && entry.path[1] === 'highlightClass') continue;

        if (!refData['CUSTRECORD_SERVICE_CUSTOMER.internalid']) continue;

        if (!sortedData[refData['CUSTRECORD_SERVICE_CUSTOMER.internalid']]) {
            sortedData[refData['CUSTRECORD_SERVICE_CUSTOMER.internalid']] = {
                customerId: refData['CUSTRECORD_SERVICE_CUSTOMER.internalid'],
                customerName: refData['CUSTRECORD_SERVICE_CUSTOMER.companyname'],
                customerEntityId: refData['CUSTRECORD_SERVICE_CUSTOMER.entityid'],
                changes: {},
            }
        }

        if (!sortedData[refData['CUSTRECORD_SERVICE_CUSTOMER.internalid']].changes[refData['internalid']]) {
            sortedData[refData['CUSTRECORD_SERVICE_CUSTOMER.internalid']].changes[refData['internalid']] = {
                serviceId: refData['internalid'],
                serviceName: refData['custrecord_service_text'],
                servicePrice: parseFloat(refData['custrecord_service_price']),
                type: '',
                adjustment: {
                    val: refData['adjustment'],
                    newVal: refData['adjustment'],
                },
                confirmed: {
                    val: refData['confirmed'],
                    newVal: refData['confirmed'],
                },
            }
        }

        sortedData[refData['CUSTRECORD_SERVICE_CUSTOMER.internalid']].changes[refData['internalid']].type = entry.type;
        if (entry.type === 'CHANGE' && entry.path[1] === 'adjustment')
            sortedData[refData['CUSTRECORD_SERVICE_CUSTOMER.internalid']].changes[refData['internalid']].adjustment.newVal = entry.value;
        if (entry.type === 'CHANGE' && entry.path[1] === 'confirmed')
            sortedData[refData['CUSTRECORD_SERVICE_CUSTOMER.internalid']].changes[refData['internalid']].confirmed.newVal = entry.value;
    }

    sortedHistoryEntry.value = {...sortedData};
})

function getMatchingReferenceData(referenceData, entry) {
    if (entry.type === 'CHANGE') return referenceData[entry.path[0]];
    else if (entry.type === 'REMOVE') return entry.oldValue;
    else if (entry.type === 'CREATE') return entry.value;

    return null;
}

function getConfirmedStatus(status) {
    if (status) return `<u class="text-green">Confirmed</u>`
    return `<u class="text-red">Unconfirmed</u>`
}
</script>

<template>
    <div v-for="(entry, key1) in sortedHistoryEntry" :key="`${key1}`" class="my-2 text-start">
        <b>{{ entry.customerEntityId }} {{ entry.customerName }}:</b>
        <ul class="ml-5">
            <li v-for="(change, key2) in entry.changes" :key="`${key1}-${key2}`" class="text-caption">
                <div v-if="change.type === 'REMOVE'">
                    <u class="text-primary"><b>{{ change.serviceName }}</b></u> was <b class="text-red">removed</b> from price increase list.
                </div>
                <div v-if="change.type === 'CREATE'">
                    <u class="text-primary"><b>{{ change.serviceName }}</b></u> was <b class="text-green">added</b> to price increase list.
                </div>
                <div v-else-if="change.type === 'CHANGE'">
                    <u class="text-primary"><b>{{ change.serviceName }} ({{ formatPrice(change.servicePrice) }})</b></u> has the following changes:
                    <ul class="ml-5">
                        <li v-if="change.adjustment.val !== change.adjustment.newVal">
                            Adjustment amount changed from <u class="text-primary">{{ formatPrice(change.adjustment.val) }}</u>
                            to <u class="text-primary">{{ formatPrice(change.adjustment.newVal) }}</u>
                        </li>
                        <li v-if="change.confirmed.val !== change.confirmed.newVal">
                            Confirmation status changed from <span v-html="getConfirmedStatus(change.confirmed.val)"></span> to
                            <span v-html="getConfirmedStatus(change.confirmed.newVal)"></span>
                        </li>
                    </ul>
                </div>
            </li>
        </ul>
    </div>
</template>

<style scoped>

</style>