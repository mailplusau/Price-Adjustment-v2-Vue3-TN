<script setup>
import { usePriceAdjustmentHistoryStore } from "@/stores/price-adjustment-history";
import ChangesDisplayRow from "@/views/price-adjustment/history-dialog/components/ChangesDisplayRow.vue";
import { ref } from "vue";

const historyStore = usePriceAdjustmentHistoryStore();
const sortBy = ref([{ key: 'created', order: 'asc' }]);
const historyTableHeaders = [
    { title: 'Changes', align: 'start', key: 'changes', sortable: false },
    { title: 'Made By', align: 'center', key: 'owner_text' },
    { title: 'Date', align: 'end', key: 'created', sortRaw: (a, b) => compareDates(a, b, 'created') },
]

function compareDates(a, b, key) {
    try {
        const rearrange = (dateTimeStr) => { // 27/10/2024 4:00:00 AM
            const [d, m, y] = dateTimeStr.split(' ')[0].split('/');
            return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
        }

        const aText = rearrange(a[key]);
        const bText = rearrange(b[key]);

        return bText.localeCompare(aText);
    } catch (e) { console.log(e); return 0; }
}
</script>

<template>
    <v-dialog width="950" v-model="historyStore.historyDialogOpen" persistent>
        <v-card color="background" class="elevation-10">
            <v-toolbar color="primary" density="compact">
                <span class="ml-4 mr-2">History</span>
                <v-spacer></v-spacer>
                <v-btn color="red" variant="elevated" size="small" @click="historyStore.historyDialogOpen = false" class="mr-2">Close</v-btn>
            </v-toolbar>

            <v-data-table-virtual class="bg-background" sticky fixed-header hover
                                  no-data-text="No History to Show"
                                  :headers="historyTableHeaders"
                                  v-model:sort-by="sortBy"
                                  :items="historyStore.historyData"
                                  item-value="internalid"
                                  :loading="historyStore.loading"
                                  loading-text="Retrieving history entries..."
                                  :height="'calc(85vh)'">
                <template v-slot:[`item.changes`]="{ item }">
                    <b v-if="item.isOriginRecord">Price Adjustment session opened</b>
                    <ChangesDisplayRow v-else :history-entry="item" />
                </template>
            </v-data-table-virtual>
        </v-card>
    </v-dialog>
</template>

<style scoped>

</style>