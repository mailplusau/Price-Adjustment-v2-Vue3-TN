<script setup>
import { computed } from "vue";
import { readFromDataCells } from "netsuite-shared-modules";

const props = defineProps(['params'])

const statusObj = computed(() => {
    const data = props.params.data;

    if (!data?.adjustmentRecord) return {text: 'text-black', status: 'Not Started'};

    if (data.adjustmentRecord['custrecord_1302_opt_out_reason']) return {text: 'text-red', status: `Opted Out`}

    const adjustmentData = readFromDataCells(data.adjustmentRecord, 'custrecord_1302_data_') || [];

    if (adjustmentData.length) {
        if (!adjustmentData.filter(item => !item['confirmed']).length) return {text: 'text-primary', status: 'All Services Confirmed'}

        if (adjustmentData.filter(item => item['confirmed']).length) return {text: 'text-warning', status: `In Progress (${adjustmentData.filter(item => item['confirmed']).length} confirmed services)`}

        if (adjustmentData.filter(item => item['adjustment'] !== 0).length) return {text: 'text-warning', status: 'In Progress'}

        return {text: 'text-warning', status: 'Initiated But No Progress'}
    }

    return {text: 'text-grey', status: 'No Eligible Customer'}
})
</script>

<template>
    <div class="text-center">
        <b :class="statusObj.text">{{ statusObj.status }}</b>
    </div>
</template>

<style scoped>

</style>