<script setup>
import PriceIncreaseTable from "@/views/price-adjustment/component/PriceIncreaseTable.vue";
import PricingRuleDialog from "@/views/price-adjustment/rule-dialog/Main.vue";
import PricingRuleDisplay from "@/views/price-adjustment/component/PricingRuleDisplay.vue";
import InlineSelect from "@/components/shared/InlineSelect.vue";
import ButtonWithConfirmationPopup from "@/components/shared/ButtonWithConfirmationPopup.vue";
import { format} from 'date-fns';
import { computed, nextTick, onMounted, ref } from "vue";
import { useFranchiseeStore } from "@/stores/franchisees";
import { usePriceAdjustment } from "@/stores/price-adjustment";
import { usePricingRules } from "@/stores/pricing-rules";
import { useUserStore } from "@/stores/user";
import { useGlobalDialog } from "@/stores/global-dialog";
import OptOutDialog from "@/views/price-adjustment/component/OptOutDialog.vue";

const franchiseeStore = useFranchiseeStore();
const userStore = useUserStore();
const globalDialog = useGlobalDialog();
const pricingRules = usePricingRules();
const priceAdjustments = usePriceAdjustment();

const showSearchBox = ref(false);
const gridSearchBox = ref();
const searchText = ref('');

onMounted(() => {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.code === 'KeyF') { // hijack ctrl+F function of the browser
            e.preventDefault();
            toggleSearchBox();
        }
    })
})

const hasUnconfirmedPriceAdjustment = computed(() => !!priceAdjustments.priceAdjustmentData.filter(item => !item.confirmed).length);
const selectedFranchisee = computed({
    get: () => franchiseeStore.current.id,
    set: async (val) => {
        globalDialog.displayProgress('', 'Retrieving Franchisee\'s Information...');
        await franchiseeStore.changeCurrentFranchiseeId(val);
        globalDialog.close(100, 'Complete!').then();
    }
})

function formatDate(dateObj) {
    return Object.prototype.toString.call(dateObj) === '[object Date]' ? format(dateObj, 'd/M/y') : dateObj;
}

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
                    <span class="ml-4 mr-1">Price Adjustment</span>

                    <v-divider vertical class="ml-4"></v-divider>

                    <v-slide-x-transition leave-absolute mode="out-in">
                        <v-card v-if="showSearchBox" color="transparent" flat>
                            <v-text-field class="ml-4" variant="solo" density="compact" ref="gridSearchBox" v-model="searchText"
                                          hide-details placeholder="Search..." persistent-placeholder max-width="400" width="400"
                                          append-icon="mdi-close" @click:append="toggleSearchBox()"></v-text-field>
                        </v-card>

                        <v-card v-else color="transparent" flat>
                            <template v-if="pricingRules.currentSession.id">
                                <InlineSelect :items="franchiseeStore.all" v-model="selectedFranchisee" item-value="internalid" item-title="companyname">
                                    <template v-slot:activator="{ activatorProps }">
                                        <span v-bind="userStore.isAdmin && !franchiseeStore.busy ? activatorProps : null" class="ml-4 mr-1 text-subtitle-2 text-secondary cursor-pointer">
                                            Franchisee:
                                            <v-progress-circular v-if="franchiseeStore.busy" indeterminate size="20" width="2" class="ml-2"></v-progress-circular>
                                            <b v-else-if="franchiseeStore.current.id"><i><u>{{ franchiseeStore.current.details.companyname }}</u></i></b>
                                            <b v-else><i><u class="text-red">[Non Selected]</u></i></b>
                                        </span>
                                    </template>
                                </InlineSelect>

                                <span class="ml-4 mr-1 text-subtitle-2 text-secondary">
                                    Deadline:
                                    <b><i><u>{{ formatDate(pricingRules.currentSession.form.custrecord_1301_deadline) }}</u></i></b>
                                </span>

                                <span class="ml-4 mr-1 text-subtitle-2 text-secondary" v-if="userStore.isAdmin">
                                    Date Effective:
                                    <b><i><u>{{ formatDate(pricingRules.currentSession.form.custrecord_1301_effective_date) }}</u></i></b>
                                </span>
                            </template>

                            <PricingRuleDisplay v-if="false">
                                <template v-slot:activator="{ activatorProps }">
                                    <b v-bind="activatorProps" class="ml-4 mr-1 text-subtitle-2 text-cyan-accent-1 cursor-pointer"><u>Pricing Rules Applied</u></b>
                                </template>
                            </PricingRuleDisplay>

                            <PricingRuleDialog class="ml-4"/>

                            <ButtonWithConfirmationPopup v-if="priceAdjustments.priceAdjustmentData.length" tooltip="Confirm all Price Adjustments for every customer"
                                                         message="Are you sure you want to confirm Price Adjustments for all Customers?"
                                                         @confirmed="priceAdjustments.confirmAllPriceAdjustments()">
                                <template v-slot:activator="{ activatorProps }">
                                    <v-btn v-bind="activatorProps" :disabled="!hasUnconfirmedPriceAdjustment"
                                           :variant="hasUnconfirmedPriceAdjustment ? 'elevated' : 'outlined'"
                                           color="green" size="small" class="ml-4">
                                        {{ hasUnconfirmedPriceAdjustment ? 'Confirm all' : 'All Confirmed' }}
                                    </v-btn>
                                </template>
                            </ButtonWithConfirmationPopup>
                        </v-card>
                    </v-slide-x-transition>

                    <v-spacer></v-spacer>

                    <OptOutDialog v-if="!showSearchBox && userStore.isFranchisee && !priceAdjustments.details.custrecord_1302_opt_out_reason && priceAdjustments.priceAdjustmentData.length"/>
                </v-toolbar>
            </v-col>
        </v-row>


        <v-row class="flex-grow-1" no-gutters>
            <PriceIncreaseTable :search-text="searchText" />
        </v-row>
    </v-card>
</template>

<style scoped>

</style>