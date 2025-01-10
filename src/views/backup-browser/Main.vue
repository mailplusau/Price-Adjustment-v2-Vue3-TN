<script setup>
import { nextTick, onMounted, ref, watch } from "vue";
import { bytesToNextUnit, readFromDataCells } from "netsuite-shared-modules";
import NavigationMenu from "@/views/layout/NavigationMenu.vue";
import { useBackupManager } from "@/stores/backup-manager";
import { useGlobalDialog } from "@/stores/global-dialog";
import { usePricingRules } from "@/stores/pricing-rules";

const globalDialog = useGlobalDialog();
const backupManager = useBackupManager();
const pricingRules = usePricingRules();
const selectedBackupFiles = ref([]);
const selectedFranchiseeData = ref([]);
const parsedBackupData = ref([]);

onMounted(() => { refreshData(); });

const backupFileTableHeaders = [
    { title: 'Backup', align: 'start', key: 'name' },
    { title: 'Size', align: 'center', key: 'sizeKB' },
    { title: '', align: 'end', key: 'opened', sortable: false },
];

const franchiseeDataTableHeaders = [
    { title: 'Franchisee', align: 'start', key: 'franchiseeName' },
    { title: 'Entries', align: 'center', key: 'entriesCount' },
    { title: 'Confirmed', align: 'center', key: 'confirmedCount' },
    { title: '', align: 'end', key: 'opened', sortable: false },
];

async function handleBackupFileTableClicked(event, item) {
    globalDialog.displayProgress('', 'Reading backup file....');
    parsedBackupData.value.splice(0);
    selectedFranchiseeData.value.splice(0);
    selectedBackupFiles.value.splice(0, 1, item.item['name']);
    await nextTick();
    await backupManager.retrieveBackupFileData(item.item['name']);

    parsedBackupData.value = backupManager.ofCurrentSession.backupData.map(franchiseeRecord => {
        const adjustmentData = readFromDataCells(franchiseeRecord, 'custrecord_1302_data_') || [];
        const masterRecordId = franchiseeRecord['custrecord_1302_master_record'];
        const franchiseeId = franchiseeRecord['custrecord_1302_franchisee']

        return {
            key: franchiseeRecord['internalid'],
            masterRecordId, franchiseeId,
            franchiseeName: franchiseeRecord['custrecord_1302_franchisee_text'],
            entriesCount: adjustmentData.length,
            confirmedCount: adjustmentData.filter(item => item['confirmed']).length
        }
    })

    await globalDialog.close(500, 'Complete!')
}

async function refreshData() {
    globalDialog.displayProgress('', 'Retrieving backups....');
    parsedBackupData.value.splice(0);
    selectedFranchiseeData.value.splice(0);
    selectedBackupFiles.value.splice(0);
    await backupManager.init();
    await globalDialog.close(500, 'Complete!');
}

async function restoreSelected() {
    const list = selectedFranchiseeData.value.map(key => {
        const data = parsedBackupData.value.filter(item => item['key'] === key)[0];
        return `<li class="text-primary"><u>${data.franchiseeName}</u></li>`
    }).sort().join('');

    const res = await globalDialog.displayConfirmation('Warning!!!',
        `Backup file <b class="text-primary">${selectedBackupFiles.value[0]}</b>`
        + ` will be used to restore data for the following franchisees:`
        + `<ul class="ml-5 my-2" style="max-height: 200px; overflow: auto">${list}</ul>`
        + `Would you like to proceed?`);

    if (!res) return;

    globalDialog.displayProgress('', 'Restoring backups...');
    for (let key of selectedFranchiseeData.value)
        await backupManager.restoreFranchiseeDataFromBackupData(key);

    globalDialog.displayInfo('Complete', 'Data has been successfully restored.', true);
}

function handleFranchiseeDataTableClicked(event, item) {
    let index = selectedFranchiseeData.value.findIndex(i => i === item.item['key'])

    if (index >= 0) selectedFranchiseeData.value.splice(index, 1);
    else selectedFranchiseeData.value.push(item.item['key']);
}

watch(() => pricingRules.currentSession.id, val => {
    if (val) refreshData();
})
</script>

<template>
    <v-container fluid class="pa-0">
        <v-toolbar color="primary" flat density="compact" class="mb-5">
            <NavigationMenu />
            <span class="mr-1">Backup Management</span>

            <v-divider vertical class="ml-4"></v-divider>
        </v-toolbar>

        <v-row justify="center" class="mx-2">
            <v-col xl="3" lg="4" md="5" cols="5">
                <v-card color="background" class="elevation-10">
                    <v-toolbar color="primary" density="compact">
                        <span class="ml-4 mr-2">Available Backups</span>
                        <v-spacer></v-spacer>
                        <v-btn icon="mdi-refresh" size="small" @click="refreshData()"></v-btn>
                    </v-toolbar>

                    <v-data-table-virtual v-model="selectedBackupFiles" no-data-text="No backup file found"
                                          class="bg-background" sticky fixed-header hover item-selectable
                                          :headers="backupFileTableHeaders"
                                          :items="backupManager.ofCurrentSession.backupFiles"
                                          item-value="name"
                                          :sort-by="[{ key: 'name', order: 'desc'}]"
                                          @click:row="handleBackupFileTableClicked"
                                          :row-props="i => i.item['name'] === selectedBackupFiles[0] ? {class: 'bg-white'} : {}"
                                          :height="backupManager.ofCurrentSession.backupFiles.length ? 'calc(100vh - 140px)' : 'unset'">
                        <template v-slot:[`item.name`]="{ item }">
                            {{ (new Date(item['name'])).toLocaleString() }}
                        </template>
                        <template v-slot:[`item.sizeKB`]="{ item }">
                            {{ bytesToNextUnit(item['sizeKB'] * 1000) }}
                        </template>
                    </v-data-table-virtual>
                </v-card>
            </v-col>

            <v-col xl="5" lg="6" md="7" cols="7">
                <v-card color="background" class="elevation-10">
                    <v-toolbar color="primary" density="compact">
                        <span class="ml-4 mr-2">Franchisees' Data</span>
                        <v-spacer></v-spacer>
                        <v-btn v-if="selectedFranchiseeData.length && !pricingRules.isSessionFinalised"
                               @click="restoreSelected()"
                               color="green" variant="elevated" size="small" class="mr-2">
                            Restore Selected ({{selectedFranchiseeData.length}})
                        </v-btn>
                    </v-toolbar>

                    <v-data-table-virtual v-model="selectedFranchiseeData" no-data-text="No backup data"
                                          class="bg-background" sticky fixed-header hover show-select
                                          :headers="franchiseeDataTableHeaders"
                                          :items="parsedBackupData"
                                          item-value="key"
                                          @click:row="handleFranchiseeDataTableClicked"
                                          :row-props="i => selectedFranchiseeData['includes'](i.item['key']) ? {class: 'bg-white'} : {}"
                                          :height="backupManager.ofCurrentSession.backupData.length ? 'calc(100vh - 140px)' : 'unset'">
                    </v-data-table-virtual>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>

<style scoped>

</style>