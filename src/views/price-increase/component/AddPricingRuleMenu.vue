<script setup>
import { computed, ref, watch } from "vue";
import { usePricingRules } from "@/stores/pricing-rules";
import { useDataStore } from "@/stores/data";
import { checkSubset } from "@/utils/utils.mjs";
import { usePriceAdjustment } from "@/stores/price-adjustment";

const dataStore = useDataStore();
const pricingRules = usePricingRules();
const priceAdjustmentRecord = usePriceAdjustment();

const menuOpen = ref(false);
const form = ref({
    serviceTypes: null,
    adjustment: 0,
})

const servicePricingRules = computed(() => priceAdjustmentRecord.id
    ? priceAdjustmentRecord.form.custrecord_1302_pricing_rules
    : pricingRules.currentSession.form.custrecord_1301_pricing_rules);

const serviceTypes = computed(() => {
    const usedTypes = [];
    for (let rule of servicePricingRules.value) usedTypes.push(...rule.services);

    return dataStore.serviceTypes.filter(item => !checkSubset(usedTypes, item.value));
})

function addNewRule() {
    if (priceAdjustmentRecord.id)
        priceAdjustmentRecord.addNewRule(form.value.serviceTypes['title'], form.value.serviceTypes['value'], form.value.adjustment);
    else
        pricingRules.addNewRule(form.value.serviceTypes['title'], form.value.serviceTypes['value'], form.value.adjustment);

    menuOpen.value = false;
}

watch(menuOpen, val => {
    if (val) form.value.serviceTypes = serviceTypes.value[0];
})
</script>

<template>
    <v-menu :close-on-content-click="false" v-model="menuOpen" location="end center" offset="-157">
        <template v-slot:activator="{ props: activatorProps }">
            <slot name="activator" :activatorProps="activatorProps"></slot>
        </template>
        <v-card :min-width="650" color="background" class="v-row justify-center">
            <v-col cols="6">
                <v-autocomplete label="Service Type:" density="compact" hide-details variant="outlined" color="primary"
                                :items="serviceTypes"
                                return-object
                                v-model="form.serviceTypes"></v-autocomplete>
            </v-col>
            <v-col cols="4">
                <v-text-field label="Adjustment (A$):" density="compact" hide-details variant="outlined" color="primary"
                              type="number" hide-spin-buttons step="0.01"
                              v-model="form.adjustment"></v-text-field>
            </v-col>
            <v-col cols="2">
                <v-btn variant="elevated" color="green" block @click="addNewRule">Add</v-btn>
            </v-col>
        </v-card>
    </v-menu>
</template>

<style scoped>

</style>