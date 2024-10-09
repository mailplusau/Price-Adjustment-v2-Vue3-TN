<script setup>
import { computed, ref } from "vue";
import { checkSubset, formatPrice, pricingRuleOperatorOptions } from "@/utils/utils.mjs";
import DatePicker from "@/components/shared/DatePicker.vue";
import InlineTextField from "@/components/shared/InlineTextField.vue";
import InlineSelect from "@/components/shared/InlineSelect.vue";
import AddPricingRuleMenu from "@/views/price-adjustment/component/AddPricingRuleMenu.vue";
import { usePricingRules } from "@/stores/pricing-rules";
import { useDataStore } from "@/stores/data";
import { useGlobalDialog } from "@/stores/global-dialog";
import { useUserStore } from "@/stores/user";
import { useFranchiseeStore } from "@/stores/franchisees";
import { usePriceAdjustment } from "@/stores/price-adjustment";
import ButtonWithConfirmationPopup from "@/components/shared/ButtonWithConfirmationPopup.vue";

const globalDialog = useGlobalDialog();
const franchiseeStore = useFranchiseeStore();
const dataStore = useDataStore();
const userStore = useUserStore();

const priceAdjustmentRule = usePricingRules();
const priceAdjustmentRecord = usePriceAdjustment();

const mainForm = ref(null);
const formValid = ref(true);
const servicePricingRules = computed(() => priceAdjustmentRecord.form.custrecord_1302_pricing_rules);
const dialogOpen = computed({
    get: () => priceAdjustmentRule.pricingRuleDialog.open,
    set: val => { priceAdjustmentRule.pricingRuleDialog.open = val; }
});
const priceAdjustmentRecordInactive = computed({
    get: () => priceAdjustmentRecord.form.custrecord_1302_cancelled,
    set: val => priceAdjustmentRecord.form.custrecord_1302_cancelled = !!val,
})

const serviceTypes = computed(() => {
    return dataStore.serviceTypes;
})

const activeOptions = [
    {title: 'without any condition', value: false},
    {title: 'when current price is', value: true},
]

function getActiveStateByIndex(index) {
    return !!servicePricingRules.value[index].conditions.length
}

function setActiveStateByIndex(index, val) {
    if (!val) servicePricingRules.value[index].conditions.splice(0);
    else servicePricingRules.value[index].conditions.push(['current_price', '=', 0, 0])
}

function getServiceTypeText(serviceTypeIds) {
    let index = dataStore.serviceTypes.findIndex(item => checkSubset(serviceTypeIds, item.value) && serviceTypeIds.length === item.value.length);
    return index < 0 ? 'Unknown' : dataStore.serviceTypes[index].title;
}

function restorePricingRulesToDefault() {
    priceAdjustmentRecord.form.custrecord_1302_pricing_rules = [...JSON.parse(priceAdjustmentRule.currentSession.details.custrecord_1301_pricing_rules)];
}

async function proceed(applyRules = false) {
    let res = await mainForm.value['validate']();
    if (!res.valid) return console.log('Fix the errors');

    globalDialog.displayProgress('', 'Saving Price Adjustment Record...');

    await priceAdjustmentRecord.savePriceAdjustmentRecord(applyRules);
    await priceAdjustmentRecord.fetchPriceAdjustmentRecord();

    await globalDialog.close(500, 'Complete!');
    dialogOpen.value = false;
}
</script>

<template>
    <v-container fluid>
        <v-form class="v-row justify-center" ref="mainForm" v-model="formValid">
            <v-col cols="12" class="text-h5 text-center text-primary">Price Adjustment Data of<br><u>{{ priceAdjustmentRecord.texts.custrecord_1302_franchisee }}</u></v-col>

            <template v-if="userStore.isAdmin">
                <v-col cols="12">
                    <v-switch :color="priceAdjustmentRecordInactive ? '' : 'primary'"
                        v-model="priceAdjustmentRecordInactive"
                        :label="priceAdjustmentRecordInactive ? 'Opted out (click to reinstate)' : 'Active (click to opt out)'"
                        hide-details
                    ></v-switch>

                </v-col>
            </template>
            <template v-else>
                <v-col cols="4" class="mb-4">
                    <DatePicker v-model="priceAdjustmentRule.currentSession.form.custrecord_1301_opening_date"
                                title="Opening Date" readonly>
                        <template v-slot:activator="{ displayDate }">
                            <v-text-field :model-value="displayDate" persistent-placeholder readonly
                                          label="Opening Date" variant="outlined" density="compact" color="primary" hide-details></v-text-field>
                        </template>
                    </DatePicker>
                </v-col>
                <v-col cols="4" class="mb-4">
                    <DatePicker v-model="priceAdjustmentRule.currentSession.form.custrecord_1301_deadline"
                                title="Deadline" readonly>
                        <template v-slot:activator="{ displayDate }">
                            <v-text-field :model-value="displayDate" persistent-placeholder readonly
                                          label="Deadline" variant="outlined" density="compact" color="primary" hide-details></v-text-field>
                        </template>
                    </DatePicker>
                </v-col>
                <v-col cols="4" class="mb-4">
                    <DatePicker v-model="priceAdjustmentRule.currentSession.form.custrecord_1301_effective_date"
                                title="Effective Date" readonly>
                        <template v-slot:activator="{ displayDate }">
                            <v-text-field :model-value="displayDate" persistent-placeholder readonly
                                          label="Effective Date" variant="outlined" density="compact" color="primary" hide-details></v-text-field>
                        </template>
                    </DatePicker>
                </v-col>
            </template>

            <v-divider></v-divider>

            <v-col cols="12">
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

                        <span v-if="pricingRule['adjustment'] > 0"> service price <b class="text-green">increases</b> by </span>
                        <span v-else-if="pricingRule['adjustment'] < 0"> service price <b class="text-red">decreases</b> by </span>
                        <span v-else> service price remains unchanged: </span>

                        <InlineTextField v-model="pricingRule['adjustment']" prefix="A$">
                            <template v-slot:activator="{ activatorProps }">
                                <span v-bind="activatorProps" class="text-primary cursor-pointer"><b><u>{{ formatPrice(Math.abs(pricingRule['adjustment'])) }}</u></b></span>
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
                                                         @confirmed="priceAdjustmentRecord.removeRule(index)">
                                <template v-slot:activator="{ activatorProps }">
                                    <v-btn v-bind="activatorProps" variant="text" color="red">
                                        <v-icon color="red" size="x-large">mdi-delete-outline</v-icon>
                                    </v-btn>
                                </template>
                            </ButtonWithConfirmationPopup>
                        </template>
                    </v-list-item>

                    <v-list-item>
                        <AddPricingRuleMenu>
                            <template v-slot:activator="{ activatorProps }">
                                <v-btn size="small" v-bind="activatorProps" variant="outlined" color="primary">
                                    <v-icon class="mr-1" size="small">mdi-plus</v-icon>Add New Rule
                                </v-btn>
                            </template>
                        </AddPricingRuleMenu>

                        <template v-slot:append>
                            <ButtonWithConfirmationPopup tooltip="Restore default pricing rules" message="Restore pricing rules to default?"
                                                         @confirmed="restorePricingRulesToDefault()">
                                <template v-slot:activator="{ activatorProps }">
                                    <v-btn v-bind="activatorProps" size="small" variant="outlined">Restore default</v-btn>
                                </template>
                            </ButtonWithConfirmationPopup>
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
                    <v-btn size="small" @click="proceed()">Save Rules</v-btn>

                    <v-menu open-on-hover location="bottom end" v-if="franchiseeStore.current.id">
                        <template v-slot:activator="{ props }">
                            <v-btn size="small" icon="mdi-chevron-down" v-bind="props"></v-btn>
                        </template>
                        <v-list density="compact">
                            <v-list-item @click="proceed(true)">
                                <v-list-item-title>Save & Apply Rules</v-list-item-title>
                            </v-list-item>
                        </v-list>
                    </v-menu>
                </v-btn-group>
            </v-col>
        </v-form>
    </v-container>
</template>

<style scoped>

</style>