<script setup>
import { usePricingRules } from "@/stores/pricing-rules";
import { useGlobalDialog } from "@/stores/global-dialog";

const pricingRules = usePricingRules();
const globalDialog = useGlobalDialog();

const customerTableHeaders = [
    { title: 'ID', align: 'start', key: 'internalid' },
    { title: 'Opening', align: 'center', key: 'custrecord_1301_opening_date', sortRaw: (a, b) => compareDatesOfSession(a, b, 'custrecord_1301_opening_date') },
    { title: 'Deadline', align: 'center', key: 'custrecord_1301_deadline', sortRaw: (a, b) => compareDatesOfSession(a, b, 'custrecord_1301_deadline') },
    { title: 'Effective', align: 'center', key: 'custrecord_1301_effective_date', sortRaw: (a, b) => compareDatesOfSession(a, b, 'custrecord_1301_effective_date') },
    { title: 'Status', align: 'center', key: 'status',
        sortRaw (a, b) {
            const aServices = getSessionStatus(a).text;
            const bServices = getSessionStatus(b).text;
            return bServices.localeCompare(aServices);
        },
    },
    { title: '', align: 'end', key: 'actions', sortable: false },
]

function compareDatesOfSession(a, b, key) {
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

function getSessionStatus(sessionRecord) {
    if (sessionRecord['custrecord_1301_completion_date'])
        return { text: 'Completed', color: 'green' }
    else if (sessionRecord['custrecord_1301_notification_date'])
        return { text: 'Notified', color: 'orange' }
    else
        return { text: 'In Session', color: 'primary' }
}

async function changeSessionId(id) {
    const res = await globalDialog.displayConfirmation('', `You are about to load <u>Price Increase Session #${id}</u>. Proceed?`);

    if (!res) return;

    globalDialog.displayProgress('', `Retrieving information of Price Increase Session #${id}...`);
    await pricingRules.changeCurrentSessionId(id);
    pricingRules.browserDialog.open = false;
    await globalDialog.close(1000, 'Load complete!')
}
</script>

<template>
    <v-dialog width="650px" v-model="pricingRules.browserDialog.open" persistent>
        <template v-slot:activator="{ props: activatorProps }">
            <slot name="activator" :activatorProps="activatorProps"></slot>
        </template>

        <v-card color="background" class="elevation-10">
            <v-toolbar color="primary" density="compact">
                <span class="ml-4 mr-2">All Price Increase Sessions</span>
                <v-spacer></v-spacer>
                <v-btn color="red" variant="elevated" size="small" @click="pricingRules.browserDialog.open = false" class="mr-2">Close</v-btn>
            </v-toolbar>

            <v-data-table-virtual class="bg-background" sticky fixed-header hover
                                  :headers="customerTableHeaders"
                                  :items="pricingRules.all"
                                  item-value="internalid"
                                  :height="'calc(50vh)'">
                <template v-slot:[`item.custrecord_1301_opening_date`]="{ item }">
                    {{ item['custrecord_1301_opening_date'].split(' ')?.[0] || '[N/A]' }}
                </template>
                <template v-slot:[`item.custrecord_1301_deadline`]="{ item }">
                    {{ item['custrecord_1301_deadline'].split(' ')?.[0] || '[N/A]' }}
                </template>
                <template v-slot:[`item.custrecord_1301_effective_date`]="{ item }">
                    {{ item['custrecord_1301_effective_date'].split(' ')?.[0] || '[N/A]' }}
                </template>
                <template v-slot:[`item.status`]="{ item }">
                    <b :class="[`text-${getSessionStatus(item).color}`]">{{getSessionStatus(item).text}}</b>
                </template>
                <template v-slot:[`item.actions`]="{ item }">
                    <v-chip v-if="item.internalid === pricingRules.currentSession.id"
                            label color="primary" size="small"><b>CURRENT</b></v-chip>

                    <v-btn v-else size="small" variant="elevated" class="ml-1" color="green"
                           @click="changeSessionId(item.internalid)">Open</v-btn>
                </template>
            </v-data-table-virtual>
        </v-card>
    </v-dialog>
</template>

<style scoped>

</style>