<script setup>
import { computed, ref, watch } from "vue";
import { usePricingRules } from "@/stores/pricing-rules";
import { useUserStore } from "@/stores/user";
import { usePriceAdjustment } from "@/stores/price-adjustment";
import PricingRuleRecordPanel from "@/views/price-adjustment/rule-dialog/components/PricingRuleRecordPanel.vue";
import PriceAdjustmentRecordPanel from "@/views/price-adjustment/rule-dialog/components/PriceAdjustmentRecordPanel.vue";

const userStore = useUserStore();

const priceAdjustmentRule = usePricingRules();
const priceAdjustmentRecord = usePriceAdjustment();

const tab = ref('one');

const dialogOpen = computed({
    get: () => priceAdjustmentRule.pricingRuleDialog.open,
    set: val => { priceAdjustmentRule.pricingRuleDialog.open = val; }
});

watch(dialogOpen, () => {
    if (priceAdjustmentRule.currentSession.id) priceAdjustmentRule.resetForm();
    if (priceAdjustmentRecord.id) priceAdjustmentRecord.resetForm();

    if (!userStore.isAdmin && priceAdjustmentRecord.id) tab.value = 'three';
    else if (userStore.isAdmin) tab.value = 'two';
})
</script>

<template>
    <v-dialog width="659" v-model="dialogOpen">
        <template v-slot:activator="{ props: activatorProps }">
            <v-btn variant="outlined" color="secondary" size="small" class="ml-4"
                   v-if="userStore.isAdmin || (userStore.isFranchisee && priceAdjustmentRule.currentSession.id)"
                   v-bind="activatorProps">
                {{ priceAdjustmentRule.currentSession.id ? 'Change Pricing Rules' : 'Create Price Increase Rule'}}
            </v-btn>
        </template>

        <v-card color="background">
            <v-tabs v-if="userStore.isAdmin" v-model="tab" bg-color="primary">
                <v-tab value="one" v-show="false">Loading...</v-tab>
                <v-tab value="two">Master Record</v-tab>
                <v-tab value="three" v-show="priceAdjustmentRecord.id">Franchisee Record</v-tab>
            </v-tabs>

            <v-tabs-window v-model="tab">
                <v-tabs-window-item value="one">
                    Null
                </v-tabs-window-item>

                <v-tabs-window-item value="two">
                    <PricingRuleRecordPanel />
                </v-tabs-window-item>

                <v-tabs-window-item value="three">
                    <PriceAdjustmentRecordPanel />
                </v-tabs-window-item>
            </v-tabs-window>
        </v-card>
    </v-dialog>
</template>

<style scoped>

</style>