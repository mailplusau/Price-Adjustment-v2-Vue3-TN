<script setup>
import { computed, nextTick, ref } from "vue";
import { formatPrice } from "@/utils/utils.mjs";
import { useGlobalDialog } from "@/stores/global-dialog";
import { usePriceAdjustment } from "@/stores/price-adjustment";

const globalDialog = useGlobalDialog();
const priceAdjustment = usePriceAdjustment();
const baseUrl = 'https://' + import.meta.env.VITE_NS_REALM + '.app.netsuite.com';
let gridApi = null;

const contextMenu = ref({
    x: 0,
    y: 0,
    show: false,
    data: null,
})

const adjustmentText = computed(() => {
    const adjustment= contextMenu.value.data['adjustment'];

    return contextMenu.value.data ? {
        colorClass: adjustment > 0 ? 'text-green' : (adjustment < 0 ? 'text-red' : ''),
        display: adjustment > 0 ? ' increase' : (adjustment < 0 ? ' decrease' : ' adjustment'),
    } : {};
});

function handleCellMouseDown(cellMouseDownEvent) {
    if (cellMouseDownEvent.event.type === 'mousedown' && cellMouseDownEvent.event.button === 2) {
        cellMouseDownEvent.event.stopPropagation();
        cellMouseDownEvent.event.preventDefault();
        
        // contextMenu.value.agGridEvent = e;
        gridApi = cellMouseDownEvent.api;
        contextMenu.value.show = false
        contextMenu.value.data = {...cellMouseDownEvent.data}
        contextMenu.value.x = cellMouseDownEvent.event.clientX
        contextMenu.value.y = cellMouseDownEvent.event.clientY
        nextTick(() => { contextMenu.value.show = true; })
    }
}

function viewCustomerRecord(customerId) {
    top.open(`${baseUrl}/app/common/entity/custjob.nl?id=${customerId}`, '_blank').focus();
}

async function applyAdjustmentToServicesOfSameType() {
    const res = await globalDialog.displayConfirmation('',
        `Apply the adjustment of <b class="text-primary">${formatPrice(contextMenu.value.data['adjustment'])}</b> to all `
        + `<b class="text-primary">${contextMenu.value.data['custrecord_service_text']}</b> services?`,
        'PROCEED', 'CANCEL');

    if (!res) return;

    globalDialog.displayProgress('', `Applying ${formatPrice(contextMenu.value.data['adjustment'])} adjustment to all ${contextMenu.value.data['custrecord_service_text']} services...`)

    const itemsToUpdate = [];
    gridApi['forEachNode']((rowNode) => {
        const data = rowNode.data;
        if (parseInt(data['custrecord_service']) === parseInt(contextMenu.value.data['custrecord_service']))
            data['adjustment'] = contextMenu.value.data['adjustment'];

        itemsToUpdate.push(data);
    });
    gridApi.applyTransaction({ update: itemsToUpdate });

    await priceAdjustment.savePriceAdjustmentRecord();
    globalDialog.close(500, 'Complete!').then();
}

async function confirmAllAdjustmentsOfSameCustomer() {
    const res = await globalDialog.displayConfirmation('',
        `Confirm all adjustments of customer <b class="text-primary">${contextMenu.value.data['CUSTRECORD_SERVICE_CUSTOMER.companyname']}</b>?`,
        'PROCEED', 'CANCEL');

    if (!res) return;

    globalDialog.displayProgress('', `Marking all adjustments of customer <b>${contextMenu.value.data['CUSTRECORD_SERVICE_CUSTOMER.companyname']}</b> as Confirmed...`)

    const itemsToUpdate = [];
    gridApi['forEachNode']((rowNode) => {
        const data = rowNode.data;
        if (parseInt(data['CUSTRECORD_SERVICE_CUSTOMER.internalid']) === parseInt(contextMenu.value.data['CUSTRECORD_SERVICE_CUSTOMER.internalid']))
            data['confirmed'] = true;

        itemsToUpdate.push(data);
    });
    gridApi.applyTransaction({ update: itemsToUpdate });

    await priceAdjustment.savePriceAdjustmentRecord();
    globalDialog.close(500, 'Complete!').then();
}

async function confirmAllAdjustmentsForSameService() {
    const res = await globalDialog.displayConfirmation('',
        `Confirm all adjustments for all <b class="text-primary">${contextMenu.value.data['custrecord_service_text']}</b> services?`,
        'PROCEED', 'CANCEL');

    if (!res) return;

    globalDialog.displayProgress('', `Marking adjustments for all <b>${contextMenu.value.data['custrecord_service_text']}</b> services as Confirmed...`)

    const itemsToUpdate = [];
    gridApi['forEachNode']((rowNode) => {
        const data = rowNode.data;
        if (parseInt(data['custrecord_service']) === parseInt(contextMenu.value.data['custrecord_service']))
            data['confirmed'] = true;

        itemsToUpdate.push(data);
    });
    gridApi.applyTransaction({ update: itemsToUpdate });

    await priceAdjustment.savePriceAdjustmentRecord();
    globalDialog.close(500, 'Complete!').then();
}

async function confirmAdjustmentsOfAllCustomers() {
    const res = await globalDialog.displayConfirmation('',
        `Confirm adjustments of all customers?`,
        'PROCEED', 'CANCEL');

    if (!res) return;

    globalDialog.displayProgress('', `Marking adjustments of all customers as Confirmed...`)
    await priceAdjustment.confirmAllPriceAdjustments()
    globalDialog.close(500, 'Complete!').then();
}

defineExpose({handleCellMouseDown})
</script>

<template>
    <v-menu min-width="100" location="bottom start" location-strategy="connected"
            v-model="contextMenu.show" :target="[contextMenu.x, contextMenu.y]">
        <v-list density="compact" bg-color="primary" class="pa-0">
            <v-list-item>
                <b class="text-secondary">{{ contextMenu.data['custrecord_service_text'] }}</b>
                <span> service of </span>
                <b class="text-secondary">{{ contextMenu.data['CUSTRECORD_SERVICE_CUSTOMER.companyname'] }}</b>
            </v-list-item>

            <v-divider></v-divider>

            <v-list-item class="text-caption" @click="viewCustomerRecord(contextMenu.data['CUSTRECORD_SERVICE_CUSTOMER.internalid'])">
                View customer's record
            </v-list-item>

            <v-divider></v-divider>

            <v-list-item class="text-caption" @click="applyAdjustmentToServicesOfSameType">
                Apply <u>{{ formatPrice(contextMenu.data['adjustment']) }}</u>
                <span :class="adjustmentText.colorClass">{{ adjustmentText.display }}</span> to all services of the same type
            </v-list-item>

            <v-list-item class="text-caption" @click="confirmAllAdjustmentsOfSameCustomer">
                Confirm all adjustments of this customer
            </v-list-item>

            <v-list-item class="text-caption" @click="confirmAllAdjustmentsForSameService">
                Confirm all adjustments for services of the same type
            </v-list-item>

            <v-divider></v-divider>

            <v-list-item class="text-caption" @click="confirmAdjustmentsOfAllCustomers">
                Confirm adjustments of all customers
            </v-list-item>
        </v-list>
    </v-menu>
</template>

<style scoped>

</style>