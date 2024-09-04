<script setup>
import { computed, ref, watch } from "vue";
import { usePriceIncreaseStore } from "@/stores/price-increase";
import { useDataStore } from "@/stores/data";
import { checkSubset } from "@/utils/utils.mjs";

const dataStore = useDataStore();
const piProcessor = usePriceIncreaseStore();

const menuOpen = ref(false);
const form = ref({
    serviceTypes: null,
    adjustment: 0,
})

const serviceTypes = computed(() => {
    const usedTypes = [];
    for (let rule of piProcessor.currentSession.form.custrecord_1301_pricing_rules) usedTypes.push(...rule.services);

    return dataStore.serviceTypes.filter(item => !checkSubset(usedTypes, item.value));
})

function addNewRule() {
    piProcessor.addNewRule(form.value.serviceTypes['title'], form.value.serviceTypes['value'], form.value.adjustment);
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