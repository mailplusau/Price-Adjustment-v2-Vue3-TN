<script setup>
import { checkSubset, formatPrice, pricingRuleOperatorOptions } from "@/utils/utils.mjs";
import InlineTextField from "@/components/shared/InlineTextField.vue";
import InlineSelect from "@/components/shared/InlineSelect.vue";
import ButtonWithConfirmationPopup from "@/components/shared/ButtonWithConfirmationPopup.vue";
import { computed, ref, watch } from "vue";
import { useDataStore } from "@/stores/data";
import { usePricingRules } from "@/stores/pricing-rules";
import { usePriceAdjustment } from "@/stores/price-adjustment";
import { priceAdjustmentTypes } from "@/utils/defaults.mjs";

const servicePricingRules = defineModel({
    required: true
});

const props = defineProps({
    showRestoreDefault: {
        required: false,
        default: false,
    }
})

const priceAdjustmentRule = usePricingRules();
const priceAdjustmentRecord = usePriceAdjustment();
const dataStore = useDataStore();

const activeOptions = [
    {title: 'without any condition', value: false},
    {title: 'when current price is', value: true},
]
const adjustmentTypes = computed(() => Object.keys(priceAdjustmentTypes).map(key => ({title: priceAdjustmentTypes[key].selectorTitle, value: priceAdjustmentTypes[key].name})))
const newRuleTemplate = {
    serviceName: null,
    services: [],
    adjustment: 0,
    adjustmentType: 'amount',
    conditions: [],
};

const selectedServiceTypes = ref(null);
const newRule = ref({...newRuleTemplate});
const editorDialog = ref(false);

const serviceTypes = computed(() => {
    return dataStore.serviceTypes;
})

const conditionActive = computed({
    get() {
        return !!newRule.value.conditions.length;
    },
    set(val) {
        console.log('conditionActive', val);
        if (!val) newRule.value.conditions.splice(0);
        else newRule.value.conditions.splice(0, Number.MAX_SAFE_INTEGER, ['current_price', '=', 0, 0])
    }
})

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

function addNewRule() {
    newRule.value.serviceName = selectedServiceTypes.value['title'];
    newRule.value.services = selectedServiceTypes.value['value'];
    servicePricingRules.value.push(JSON.parse(JSON.stringify(newRule.value)));
    editorDialog.value = false;
}

function removeRule(index) {
    servicePricingRules.value.splice(index, 1);
}

function restorePricingRulesToDefault() {
    priceAdjustmentRecord.form.custrecord_1302_pricing_rules = [...JSON.parse(priceAdjustmentRule.currentSession.details.custrecord_1301_pricing_rules)];
}

watch(editorDialog, val => {
    if (val) {
        console.log('reset')
        selectedServiceTypes.value = selectedServiceTypes.value || serviceTypes.value[0];
        newRule.value = {...newRuleTemplate};
    }
})
</script>

<template>
    <v-list class="bg-background">
        <v-list-item>
            Pricing Rules:
        </v-list-item>

        <v-list-item v-for="(pricingRule, index) in servicePricingRules" :key="'rule' + index">
            <InlineSelect :items="serviceTypes" v-model="pricingRule['services']">
                <template v-slot:activator="{ activatorProps }">
                    <span v-bind="activatorProps" class="text-primary cursor-pointer"><b><u>{{ getServiceTypeText(pricingRule['services']) }}</u></b></span>
                </template>
            </InlineSelect>

            <span v-if="pricingRule['adjustment'] !== 0"> service price adjust </span>
            <span v-else> service price remains unchanged:</span>

            <InlineSelect v-if="pricingRule['adjustment'] !== 0"
                          :items="adjustmentTypes" :model-value="getAdjustmentTypeByIndex(index)" @update:model-value="v => setAdjustmentTypeByIndex(index, v)">
                <template v-slot:activator="{ activatorProps, selectedTitle }">
                    <span v-bind="activatorProps" class="text-blue-darken-1 cursor-pointer"><b><u>{{ selectedTitle }}</u></b></span>
                </template>
            </InlineSelect>

            <span>&nbsp;</span>
            <InlineTextField v-model="pricingRule['adjustment']" :prefix="pricingRule['adjustmentType'] === 'percentage' ? '%' : 'A$'">
                <template v-slot:activator="{ activatorProps }">
                    <span v-if="pricingRule['adjustmentType'] === 'percentage'" v-bind="activatorProps" class="text-purple-darken-2 cursor-pointer"><b><u>of {{ pricingRule['adjustment'] }}%</u></b></span>
                    <span v-else v-bind="activatorProps" class="text-purple-darken-2 cursor-pointer"><b><u>of {{ formatPrice(Math.abs(pricingRule['adjustment'])) }}</u></b></span>
                </template>
            </InlineTextField>

            <span>&nbsp;</span>
            <InlineSelect :items="activeOptions" :model-value="getActiveStateByIndex(index)" @update:model-value="v => setActiveStateByIndex(index, v)">
                <template v-slot:activator="{ activatorProps, selectedTitle }">
                    <span v-bind="activatorProps" class="text-blue-darken-1 cursor-pointer"><b><u>{{ selectedTitle }}</u></b></span>
                </template>
            </InlineSelect>

            <template v-if="getActiveStateByIndex(index)">
                <span>&nbsp;</span>
                <InlineSelect :items="pricingRuleOperatorOptions" v-model="pricingRule['conditions'][0][1]">
                    <template v-slot:activator="{ activatorProps, selectedTitle }">
                        <span v-bind="activatorProps" class="text-purple-darken-2 cursor-pointer"><b><u>{{ selectedTitle }}</u></b></span>
                    </template>
                </InlineSelect>

                <span>&nbsp;</span>
                <InlineTextField v-model="pricingRule['conditions'][0][2]" prefix="A$">
                    <template v-slot:activator="{ activatorProps }">
                        <span v-bind="activatorProps" class="text-primary cursor-pointer"><b><u>{{ formatPrice(pricingRule['conditions'][0][2]) }}</u></b></span>
                    </template>
                </InlineTextField>

                <template v-if="['<>', '><'].includes(pricingRule['conditions'][0][1])">
                    <span>&nbsp;and&nbsp;</span>
                    <InlineTextField v-model="pricingRule['conditions'][0][3]" prefix="A$">
                        <template v-slot:activator="{ activatorProps }">
                            <span v-bind="activatorProps" class="text-primary cursor-pointer"><b><u>{{ formatPrice(pricingRule['conditions'][0][3]) }}</u></b></span>
                        </template>
                    </InlineTextField>
                </template>
            </template>

            <template v-slot:prepend>
                <v-icon size="40" color="primary">mdi-arrow-right-thin</v-icon>
            </template>

            <template v-slot:append>
                <ButtonWithConfirmationPopup tooltip="Delete rule" message="Delete this pricing rule?"
                                             @confirmed="removeRule(index)">
                    <template v-slot:activator="{ activatorProps }">
                        <v-btn v-bind="activatorProps" variant="text" color="red">
                            <v-icon color="red" size="x-large">mdi-delete-outline</v-icon>
                        </v-btn>
                    </template>
                </ButtonWithConfirmationPopup>
            </template>
        </v-list-item>

        <v-list-item>
<!--            <AddPricingRuleMenu>-->
<!--                <template v-slot:activator="{ activatorProps }">-->
<!--                    <v-btn size="small" v-bind="activatorProps" variant="outlined" color="primary">-->
<!--                        <v-icon class="mr-1" size="small">mdi-plus</v-icon>Add New Rule-->
<!--                    </v-btn>-->
<!--                </template>-->
<!--            </AddPricingRuleMenu>-->

            <v-dialog width="550" v-model="editorDialog">
                <template v-slot:activator="{ props: activatorProps }">
                    <v-btn size="small" v-bind="activatorProps" variant="outlined" color="primary">
                        <v-icon class="mr-1" size="small">mdi-plus</v-icon>Add New Rule
                    </v-btn>
                </template>

                <v-card :width="700" color="background" class="v-container v-container--fluid" elevation="10">
                    <v-row justify="center" align="center">
                        <v-col cols="12">
                            <v-autocomplete label="Service Type:" density="compact" hide-details variant="outlined" color="primary"
                                            :items="serviceTypes"
                                            return-object
                                            v-model="selectedServiceTypes"></v-autocomplete>
                        </v-col>
                        <v-col cols="9">
                            <v-autocomplete prefix="Adjust service price" density="compact" hide-details variant="outlined" color="primary"
                                            :items="adjustmentTypes" persistent-placeholder
                                            v-model="newRule.adjustmentType">
                            </v-autocomplete>
                        </v-col>
                        <v-col cols="3">
                            <v-text-field prefix="" density="compact" hide-details variant="outlined" color="primary"
                                          type="number" hide-spin-buttons step="0.01" persistent-placeholder
                                          v-model="newRule.adjustment">
                                <template v-slot:default>
                                    <b class="text-grey-darken-2">{{ newRule.adjustmentType === 'percentage' ? 'of (%)' : 'of A$' }}</b>
                                </template>
                            </v-text-field>
                        </v-col>
                        <v-col :cols="conditionActive ? 6 : 12">
                            <v-select v-model="conditionActive" :items="activeOptions"
                                      density="compact" hide-details variant="outlined" color="primary"></v-select>
                        </v-col>
                        <v-col cols="6" v-if="conditionActive">
                            <v-select v-model="newRule.conditions[0][1]" :items="pricingRuleOperatorOptions"
                                      density="compact" hide-details variant="outlined" color="primary"></v-select>
                        </v-col>
                        <v-col :cols="['<>', '><'].includes(newRule.conditions[0][1]) ? 6 : 12" v-if="conditionActive">
                            <v-text-field density="compact" hide-details variant="outlined" color="primary"
                                          type="number" hide-spin-buttons step="0.01" prefix="A$" persistent-placeholder placeholder="0.00"
                                          v-model="newRule.conditions[0][2]"></v-text-field>
                        </v-col>
                        <v-col cols="6" v-if="conditionActive && ['<>', '><'].includes(newRule.conditions[0][1])">
                            <v-text-field density="compact" hide-details variant="outlined" color="primary"
                                          type="number" hide-spin-buttons step="0.01" prefix="A$" persistent-placeholder placeholder="0.00"
                                          v-model="newRule.conditions[0][4]"></v-text-field>
                        </v-col>
                        <v-col cols="6">
                            <v-btn variant="elevated" color="green" block @click="addNewRule">Add</v-btn>
                        </v-col>
                    </v-row>
                </v-card>
            </v-dialog>

            <template v-slot:append>
                <ButtonWithConfirmationPopup v-if="props.showRestoreDefault"
                                             tooltip="Restore default pricing rules" message="Restore pricing rules to default?"
                                             @confirmed="restorePricingRulesToDefault()">
                    <template v-slot:activator="{ activatorProps }">
                        <v-btn v-bind="activatorProps" size="small" variant="outlined">Restore default</v-btn>
                    </template>
                </ButtonWithConfirmationPopup>
            </template>
        </v-list-item>
    </v-list>
</template>

<style scoped>

</style>