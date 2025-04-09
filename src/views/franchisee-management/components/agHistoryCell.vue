<script setup>
import { usePriceAdjustmentHistoryStore } from "@/stores/price-adjustment-history";

const props = defineProps(['params']);
const paHistory = usePriceAdjustmentHistoryStore();

async function loadHistory() {
    paHistory.openHistoryDialog(props.params.data['adjustmentRecord']['internalid']).then();
}
</script>

<template>
    <div class="text-center">
        <v-btn v-if="props.params.data['adjustmentRecord']" size="x-small" variant="elevated" color="green" @click="loadHistory()" class="mb-1">
            History
        </v-btn>
        <v-btn v-else disabled size="x-small" variant="flat" class="mb-1">No history</v-btn>
    </div>
</template>

<style scoped>

</style>