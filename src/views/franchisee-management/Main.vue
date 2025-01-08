<script setup>
import NavigationMenu from "@/views/layout/NavigationMenu.vue";
import PricingRuleDialog from "@/views/price-adjustment/rule-dialog/Main.vue";
import FranchiseeTable from "@/views/franchisee-management/components/FranchiseeTable.vue";
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useFranchiseeManager } from "@/stores/franchisee-manager";
import { usePricingRules } from "@/stores/pricing-rules";
import { useGlobalDialog } from "@/stores/global-dialog";

const pricingRules = usePricingRules();
const globalDialog = useGlobalDialog();
const franchiseeManager = useFranchiseeManager();

const showSearchBox = ref(false);
const gridSearchBox = ref();
const searchText = ref('');

const handleCtrlF = (e) => {
    if (e.ctrlKey && e.code === 'KeyF') { // hijack ctrl+F function of the browser
        e.preventDefault();
        toggleSearchBox();
    }
}

onMounted(async () => {
    globalDialog.displayProgress('', 'Retrieving all franchisees...');
    await franchiseeManager.init();
    await globalDialog.close(500, 'Complete');

    document.addEventListener('keydown', handleCtrlF);
})

onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleCtrlF);
})

function toggleSearchBox() {
    showSearchBox.value = !showSearchBox.value;
    if (showSearchBox.value)
        nextTick(() => {
            setTimeout(() => { gridSearchBox.value.focus(); }, 500)
        })
    else searchText.value = '';
}
</script>

<template>
    <v-card class="grow d-flex flex-column flex-nowrap" style="height: 100%" fluid color="background">
        <v-row class="flex-grow-0" no-gutters>
            <v-col cols="12" class="shrink">
                <v-toolbar color="primary" flat density="compact">
                    <NavigationMenu />
                    <span class="mr-1">Franchisee Management</span>

                    <v-divider vertical class="ml-4"></v-divider>

                    <v-slide-x-transition leave-absolute mode="out-in">
                        <v-card v-if="showSearchBox" color="transparent" flat>
                            <v-text-field class="ml-4" variant="solo" density="compact" ref="gridSearchBox" v-model="searchText"
                                          hide-details placeholder="Search..." persistent-placeholder max-width="400" width="400"
                                          append-icon="mdi-close" @click:append="toggleSearchBox()"></v-text-field>
                        </v-card>

                        <v-card v-else color="transparent" flat>
                            <PricingRuleDialog class="ml-4" :show-franchisee-record="false"/>

                            <v-btn v-if="pricingRules.currentSession.id"
                                   variant="outlined" color="secondary" size="small" class="ml-4" @click="franchiseeManager.init()">
                                Refresh
                            </v-btn>

                            <v-menu transition="scale-transition" v-if="pricingRules.currentSession.id">
                                <template v-slot:activator="{ props, isActive }">
                                    <v-btn variant="elevated" color="green" size="small" class="ml-4" v-bind="props">
                                        Export
                                        <v-divider vertical class="mx-2"></v-divider>
                                        <v-icon class="toggleUpDown" :class="{ 'rotate': isActive }">
                                            mdi-chevron-down
                                        </v-icon>
                                    </v-btn>
                                </template>

                                <v-list density="compact">
                                    <v-list-item @click="franchiseeManager.exportFranchiseeSessionStatus()">
                                        <v-list-item-title>Session Statuses</v-list-item-title>
                                    </v-list-item>
                                    <v-list-item @click="franchiseeManager.exportAllFranchiseeAdjustmentData()">
                                        <v-list-item-title>Confirmed Adjustments</v-list-item-title>
                                    </v-list-item>
                                </v-list>
                            </v-menu>

                            <v-btn v-if="pricingRules.currentSession.id && !pricingRules.isSessionFinalised"
                                   variant="outlined" color="secondary" size="small" class="ml-4"
                                   @click="franchiseeManager.triggerUpdateOnAllFranchiseesWhoHaveData()">
                                Trigger Update
                            </v-btn>
                        </v-card>

                    </v-slide-x-transition>
                </v-toolbar>
            </v-col>
        </v-row>


        <v-row class="flex-grow-1" no-gutters>
            <FranchiseeTable :search-text="searchText" />
        </v-row>
    </v-card>
</template>

<style scoped>
.toggleUpDown {
    transition: transform .3s ease-in-out !important;
}

.toggleUpDown.rotate {
    transform: rotate(180deg);
}
</style>