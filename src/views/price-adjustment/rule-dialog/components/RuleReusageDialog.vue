<script setup>
import { computed, ref } from "vue";
import { checkSubset, formatPrice, pricingRuleOperatorOptions } from "@/utils/utils.mjs";
import InlineTextField from "@/components/shared/InlineTextField.vue";
import InlineSelect from "@/components/shared/InlineSelect.vue";
import { priceAdjustmentTypes } from "@/utils/defaults.mjs";
import { useDataStore } from "@/stores/data";
import { usePricingRules } from "@/stores/pricing-rules";

const model = defineModel({required: true, type: Array, validator: Array.isArray});

const priceAdjustmentRule = usePricingRules();
const dataStore = useDataStore();

const activeOptions = [
    {title: 'without any condition', value: false},
    {title: 'when current price is', value: true},
]
const dialogOpen = ref(false);
const selectedPastRule = ref(null);
const servicePricingRules = ref([]);
const adjustmentTypes = computed(() => Object.keys(priceAdjustmentTypes).map(key => ({title: priceAdjustmentTypes[key].selectorTitle, value: priceAdjustmentTypes[key].name})));
const pastSessions = computed(() => priceAdjustmentRule.all
    .map(item => ({...item, title: `Session #${item['internalid']} (Effective: ${item['custrecord_1301_effective_date'].split(' ')?.[0]})`}))
    .sort((a, b) => parseInt(b['internalid']) - parseInt(a['internalid'])));


const serviceTypes = computed(() => {
    return dataStore.serviceTypes;
})

function handleSelectedPastRuleChanged() {
    servicePricingRules.value.splice(0);

    if (!selectedPastRule.value) return;

    try {
        servicePricingRules.value.push(...JSON.parse(selectedPastRule.value['custrecord_1301_pricing_rules']));
    } catch (e) {/* ignore */}
}

function getActiveStateByIndex(index) {
    return !!servicePricingRules.value[index].conditions.length
}

function setActiveStateByIndex(index, val) {
    if (!val) servicePricingRules.value[index].conditions.splice(0);
    else servicePricingRules.value[index].conditions.push(['current_price', '=', 0, 0])
}

function getAdjustmentTypeByIndex(index) {
    return servicePricingRules.value[index].adjustmentType
}

function setAdjustmentTypeByIndex(index, val) {
    servicePricingRules.value[index].adjustmentType = val;
}

function getServiceTypeText(serviceTypeIds) {
    let index = dataStore.serviceTypes.findIndex(item => checkSubset(serviceTypeIds, item.value) && serviceTypeIds.length === item.value.length);
    return index < 0 ? 'Unknown' : dataStore.serviceTypes[index].title;
}

function proceed() {
    model.value.push(...servicePricingRules.value);
    servicePricingRules.value.splice(0);
    dialogOpen.value = false;
}
</script>

<template>
    <v-dialog width="650" v-model="dialogOpen">
        <template v-slot:activator="{ props: dialogActivator }">
            <slot name="activator" :dialogActivator="dialogActivator"></slot>
        </template>

        <v-card color="background" class="v-container v-container--fluid" elevation="10">
            <v-form class="v-row justify-center" ref="mainForm">
                <v-col cols="12" class="text-h5 text-center text-red font-weight-bold">Add Rules From Past Price Increase Sessions</v-col>

                <v-col cols="12" class="mb-4">
                    <v-autocomplete label="Past Price Increase Sessions" density="compact" variant="outlined" color="primary" hide-details
                                    :items="pastSessions" v-model="selectedPastRule" return-object
                                    item-title="title"
                                    @update:model-value="handleSelectedPastRuleChanged"></v-autocomplete>
                </v-col>

                <v-divider></v-divider>

                <v-col cols="12">
                    <v-list class="bg-background" style="max-height: 55vh; overflow-y: scroll">
                        <v-list-item>
                            Pricing Rules:
                        </v-list-item>

                        <v-list-item class="text-grey" v-if="!servicePricingRules.length"><i>None to show</i></v-list-item>

                        <v-list-item v-for="(pricingRule, index) in servicePricingRules" :key="'rule' + index">
                            <InlineSelect :items="serviceTypes" v-model="pricingRule['services']" readonly>
                                <template v-slot:activator="{ activatorProps }">
                                    <span v-bind="activatorProps" class="text-primary cursor-pointer"><b><u>{{ getServiceTypeText(pricingRule['services']) }}</u></b></span>
                                </template>
                            </InlineSelect>

                            <span v-if="pricingRule['adjustment'] !== 0"> price adjust </span>
                            <span v-else> price remains unchanged:</span>

                            <InlineSelect v-if="pricingRule['adjustment'] !== 0" :items="adjustmentTypes" readonly
                                          :model-value="getAdjustmentTypeByIndex(index)" @update:model-value="v => setAdjustmentTypeByIndex(index, v)">
                                <template v-slot:activator="{ activatorProps, selectedTitle }">
                                    <span v-bind="activatorProps" class="text-blue-darken-1 cursor-pointer"><b><u>{{ selectedTitle }}</u></b></span>
                                </template>
                            </InlineSelect>

                            <span>&nbsp;</span>
                            <InlineTextField v-model="pricingRule['adjustment']" :prefix="pricingRule['adjustmentType'] === 'percentage' ? '%' : 'A$'" readonly>
                                <template v-slot:activator="{ activatorProps }">
                                    <span v-if="pricingRule['adjustmentType'] === 'percentage'" v-bind="activatorProps" class="text-purple-darken-2 cursor-pointer"><b><u>of {{ pricingRule['adjustment'] }}%</u></b></span>
                                    <span v-else v-bind="activatorProps" class="text-purple-darken-2 cursor-pointer"><b><u>of {{ formatPrice(Math.abs(pricingRule['adjustment'])) }}</u></b></span>
                                </template>
                            </InlineTextField>

                            <span>&nbsp;</span>
                            <InlineSelect :items="activeOptions" :model-value="getActiveStateByIndex(index)" @update:model-value="v => setActiveStateByIndex(index, v)" readonly>
                                <template v-slot:activator="{ activatorProps, selectedTitle }">
                                    <span v-bind="activatorProps" class="text-blue-darken-1 cursor-pointer"><b><u>{{ selectedTitle }}</u></b></span>
                                </template>
                            </InlineSelect>

                            <template v-if="getActiveStateByIndex(index)">
                                <span>&nbsp;</span>
                                <InlineSelect :items="pricingRuleOperatorOptions" v-model="pricingRule['conditions'][0][1]" readonly>
                                    <template v-slot:activator="{ activatorProps, selectedTitle }">
                                        <span v-bind="activatorProps" class="text-purple-darken-2 cursor-pointer"><b><u>{{ selectedTitle }}</u></b></span>
                                    </template>
                                </InlineSelect>

                                <span>&nbsp;</span>
                                <InlineTextField v-model="pricingRule['conditions'][0][2]" prefix="A$" readonly>
                                    <template v-slot:activator="{ activatorProps }">
                                        <span v-bind="activatorProps" class="text-primary cursor-pointer"><b><u>{{ formatPrice(pricingRule['conditions'][0][2]) }}</u></b></span>
                                    </template>
                                </InlineTextField>

                                <template v-if="['<>', '><'].includes(pricingRule['conditions'][0][1])">
                                    <span>&nbsp;and&nbsp;</span>
                                    <InlineTextField v-model="pricingRule['conditions'][0][3]" prefix="A$" readonly>
                                        <template v-slot:activator="{ activatorProps }">
                                            <span v-bind="activatorProps" class="text-primary cursor-pointer"><b><u>{{ formatPrice(pricingRule['conditions'][0][3]) }}</u></b></span>
                                        </template>
                                    </InlineTextField>
                                </template>
                            </template>

                            <template v-slot:prepend>
                                <v-icon size="40" color="primary">mdi-arrow-right-thin</v-icon>
                            </template>

                        </v-list-item>
                    </v-list>
                </v-col>

                <v-col cols="auto">
                    <v-btn-group variant="elevated" divided density="compact">
                        <v-btn @click="dialogOpen = false">cancel</v-btn>
                    </v-btn-group>
                </v-col>

                <v-col cols="auto">
                    <v-btn-group variant="elevated" color="green" divided density="compact">
                        <v-btn @click="proceed()" :disabled="!servicePricingRules.length">Add These Rules</v-btn>
                    </v-btn-group>
                </v-col>
            </v-form>
        </v-card>
    </v-dialog>
</template>

<style scoped>

</style>