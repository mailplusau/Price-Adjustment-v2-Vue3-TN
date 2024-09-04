<script setup>
import { computed } from "vue";
import { checkSubset, formatPrice } from "@/utils/utils.mjs";
import { useDataStore } from "@/stores/data";
import { usePriceIncreaseStore } from "@/stores/price-increase";

const dataStore = useDataStore();
const piProcessor = usePriceIncreaseStore();

const pricingRules = computed(() => piProcessor.currentSession.form.custrecord_1301_pricing_rules);

function getServiceTypeText(serviceTypeIds) {
    let index = dataStore.serviceTypes.findIndex(item => checkSubset(serviceTypeIds, item.value) && serviceTypeIds.length === item.value.length);
    return index < 0 ? 'Unknown' : dataStore.serviceTypes[index].title;
}
</script>

<template>
    <v-menu open-on-hover location="bottom center">
        <template v-slot:activator="{ props: activatorProps }">
            <slot name="activator" :activatorProps="activatorProps"></slot>
        </template>
        <v-card min-width="250" color="background" class="bg-background py-3 pr-3 pl-1">
            <div v-for="(pricingRule, index) in pricingRules" :key="'rule' + index" class="pricing-rule text-subtitle-2">
                <v-icon class="mr-1" size="large">mdi-circle-small</v-icon>
                <span class="text-primary cursor-pointer"><b><u>{{ getServiceTypeText(pricingRule.services) }}</u></b></span>

                <span v-if="pricingRule.adjustment > 0"> service price <b class="text-green">increases</b> by </span>
                <span v-else-if="pricingRule.adjustment < 0"> service price <b class="text-red">decreases</b> by </span>
                <span v-else> service price remains unchanged: </span>

                <span class="text-primary cursor-pointer"><b><u>{{ formatPrice(pricingRule.adjustment) }}</u></b></span>
            </div>
        </v-card>
    </v-menu>
</template>

<style scoped>

</style>