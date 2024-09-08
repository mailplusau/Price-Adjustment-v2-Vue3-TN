<script setup>
import PriceIncreaseTable from "@/views/price-increase/component/PriceIncreaseTable.vue";
import { useFranchiseeStore } from "@/stores/franchisees";
import PricingRuleDialog from "@/views/price-increase/component/PricingRuleDialog.vue";
import PricingRuleDisplay from "@/views/price-increase/component/PricingRuleDisplay.vue";
import { usePricingRules } from "@/stores/pricing-rules";
import { formatDate } from "../utils/utils.mjs";
import InlineSelect from "@/components/shared/InlineSelect.vue";
import { computed } from "vue";
import { useUserStore } from "@/stores/user";
import ButtonWithConfirmationPopup from "@/components/shared/ButtonWithConfirmationPopup.vue";
import { usePriceAdjustment } from "@/stores/price-adjustment";

const franchiseeStore = useFranchiseeStore();
const userStore = useUserStore();
const pricingRules = usePricingRules();
const priceAdjustments = usePriceAdjustment();

const selectedFranchisee = computed({
    get: () => franchiseeStore.current.id,
    set: (val) => { franchiseeStore.changeCurrentFranchiseeId(val); }
})

const hasUnconfirmedPriceAdjustment = computed(() => !!priceAdjustments.priceAdjustmentData.filter(item => !item.confirmed).length)
</script>

<template>
    <v-card class="grow d-flex flex-column flex-nowrap" style="height: 100%" fluid color="background">
        <v-row class="flex-grow-0" no-gutters>
            <v-col cols="12" class="shrink">
                <v-toolbar color="primary" flat density="compact">
                    <span class="ml-4 mr-1">Price Adjustment</span>

                    <v-divider vertical class="ml-4"></v-divider>

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

                    <v-divider vertical class="ml-4"></v-divider>

                    <ButtonWithConfirmationPopup v-if="priceAdjustments.priceAdjustmentData.length" tooltip="Confirm all Price Increase for all"
                                                 message="Are you sure you want to confirm Price Increase for all Customers?"
                                                 @confirmed="priceAdjustments.confirmAllPriceAdjustments()">
                        <template v-slot:activator="{ activatorProps }">
                            <v-btn v-bind="activatorProps" :disabled="!hasUnconfirmedPriceAdjustment"
                                   :variant="hasUnconfirmedPriceAdjustment ? 'elevated' : 'outlined'"
                                   color="green" size="small" class="ml-4">
                                {{ hasUnconfirmedPriceAdjustment ? 'Confirm all' : 'All Confirmed' }}
                            </v-btn>
                        </template>
                    </ButtonWithConfirmationPopup>
                </v-toolbar>
            </v-col>
        </v-row>


        <v-row class="flex-grow-1" no-gutters>
            <PriceIncreaseTable />
        </v-row>
    </v-card>
</template>

<style scoped>

</style>