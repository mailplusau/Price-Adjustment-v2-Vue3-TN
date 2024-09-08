<script setup>
import { computed, ref, watch } from "vue";
import { checkSubset, formatPrice, rules } from "@/utils/utils.mjs";
import { set } from 'date-fns';
import DatePicker from "@/components/shared/DatePicker.vue";
import InlineTextField from "@/components/shared/InlineTextField.vue";
import InlineSelect from "@/components/shared/InlineSelect.vue";
import AddPricingRuleMenu from "@/views/price-increase/component/AddPricingRuleMenu.vue";
import { usePricingRules } from "@/stores/pricing-rules";
import { useDataStore } from "@/stores/data";
import { useGlobalDialog } from "@/stores/global-dialog";
import { useUserStore } from "@/stores/user";
import { useFranchiseeStore } from "@/stores/franchisees";
import { usePriceAdjustment } from "@/stores/price-adjustment";

const globalDialog = useGlobalDialog();
const franchiseeStore = useFranchiseeStore();
const dataStore = useDataStore();
const userStore = useUserStore();

const priceAdjustmentRule = usePricingRules();
const priceAdjustmentRecord = usePriceAdjustment();

const { validate } = rules;
const mainForm = ref(null);
const formValid = ref(true);
const servicePricingRules = computed(() => priceAdjustmentRecord.id
    ? priceAdjustmentRecord.form.custrecord_1302_pricing_rules
    : priceAdjustmentRule.currentSession.form.custrecord_1301_pricing_rules);
const dialogOpen = computed({
    get: () => priceAdjustmentRule.pricingRuleDialog.open,
    set: val => { priceAdjustmentRule.pricingRuleDialog.open = val; }
});

const serviceTypes = computed(() => {
    const usedTypes = [];
    for (let rule of servicePricingRules.value) usedTypes.push(...rule.services);

    return dataStore.serviceTypes.filter(item => !checkSubset(usedTypes, item.value));
})

const minDeadline = computed(() => !priceAdjustmentRule.currentSession.form.custrecord_1301_opening_date
    ? '' : set(priceAdjustmentRule.currentSession.form.custrecord_1301_opening_date, {hours: 14, minutes: 0, seconds: 0, milliseconds: 0}).toISOString());

const minEffectiveDate = computed(() => !priceAdjustmentRule.currentSession.form.custrecord_1301_deadline
    ? '' : set(priceAdjustmentRule.currentSession.form.custrecord_1301_deadline, {hours: 14, minutes: 0, seconds: 0, milliseconds: 0}).toISOString());

function getServiceTypeText(serviceTypeIds) {
    let index = dataStore.serviceTypes.findIndex(item => checkSubset(serviceTypeIds, item.value) && serviceTypeIds.length === item.value.length);
    return index < 0 ? 'Unknown' : dataStore.serviceTypes[index].title;
}

async function proceed(applyRules = false) {
    let res = await mainForm.value['validate']();
    if (!res.valid) return console.log('Fix the errors');

    globalDialog.displayProgress('', 'Saving Price Increase Record...');

    if (priceAdjustmentRecord.id) {
        await priceAdjustmentRecord.savePriceAdjustmentRecord(applyRules);
        await priceAdjustmentRecord.fetchPriceAdjustmentRecord();
    }
    else if (priceAdjustmentRule.currentSession.id) await priceAdjustmentRule.savePricingRules();
    else await priceAdjustmentRule.createNewRuleRecord();

    await globalDialog.close(500, 'Complete!');
    dialogOpen.value = false;
}

watch(dialogOpen, () => {
    if (priceAdjustmentRecord.id) priceAdjustmentRecord.resetForm();
    else priceAdjustmentRule.resetForm();
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
            <v-container fluid>
                <v-form class="v-row justify-center" ref="mainForm" v-model="formValid">
                    <v-col cols="12" class="text-h5 text-center text-primary">Rules for Price Increase 2024</v-col>

                    <template v-if="userStore.isAdmin">
                        <v-col cols="4">
                            <DatePicker v-model="priceAdjustmentRule.currentSession.form.custrecord_1301_opening_date" title="Opening Date"
                                        @update:model-value="priceAdjustmentRule.handleDatesChanged">
                                <template v-slot:activator="{ activatorProps, displayDate }">
                                    <v-text-field v-bind="activatorProps" :model-value="displayDate" persistent-placeholder
                                                  :rules="[v => validate(v, 'required')]"
                                                  label="Opening Date" variant="outlined" density="compact" color="primary" hide-details></v-text-field>
                                </template>
                            </DatePicker>
                        </v-col>
                        <v-col cols="4">
                            <DatePicker v-model="priceAdjustmentRule.currentSession.form.custrecord_1301_deadline" title="Deadline" :min="minDeadline"
                                        :disabled="!priceAdjustmentRule.currentSession.form.custrecord_1301_opening_date"
                                        @update:model-value="priceAdjustmentRule.handleDatesChanged">
                                <template v-slot:activator="{ activatorProps, displayDate, disabled }">
                                    <v-text-field v-bind="activatorProps" :model-value="displayDate" persistent-placeholder
                                                  :rules="[v => validate(v, 'required')]" :disabled="disabled"
                                                  label="Deadline" variant="outlined" density="compact" color="primary" hide-details></v-text-field>
                                </template>
                            </DatePicker>
                        </v-col>
                        <v-col cols="4">
                            <DatePicker v-model="priceAdjustmentRule.currentSession.form.custrecord_1301_effective_date" title="Effective Date" :min="minEffectiveDate"
                                        :disabled="!priceAdjustmentRule.currentSession.form.custrecord_1301_deadline"
                                        @update:model-value="priceAdjustmentRule.handleDatesChanged">
                                <template v-slot:activator="{ activatorProps, displayDate, disabled }">
                                    <v-text-field v-bind="activatorProps" :model-value="displayDate" persistent-placeholder
                                                  :rules="[v => validate(v, 'required')]" :disabled="disabled"
                                                  label="Effective Date" variant="outlined" density="compact" color="primary" hide-details></v-text-field>
                                </template>
                            </DatePicker>
                        </v-col>
                        <v-col cols="6">
                            <v-text-field label="Month" variant="outlined" density="compact" color="primary" hide-details readonly
                                          v-model="priceAdjustmentRule.currentSession.form.custrecord_1301_month"></v-text-field>
                        </v-col>
                        <v-col cols="6">
                            <v-text-field label="Year" variant="outlined" density="compact" color="primary" hide-details readonly
                                          v-model="priceAdjustmentRule.currentSession.form.custrecord_1301_year"></v-text-field>
                        </v-col>
                    </template>

                    <v-divider class="mt-4"></v-divider>

                    <v-col cols="12">
                        <v-list class="bg-background">
                            <v-list-item>
                                Pricing Rules:
                            </v-list-item>

                            <v-list-item v-for="(pricingRule, index) in servicePricingRules" :key="'rule' + index">
                                <InlineSelect :items="serviceTypes" v-model="pricingRule.services">
                                    <template v-slot:activator="{ activatorProps }">
                                        <span v-bind="activatorProps" class="text-primary cursor-pointer"><b><u>{{ getServiceTypeText(pricingRule.services) }}</u></b></span>
                                    </template>
                                </InlineSelect>

                                <span v-if="pricingRule.adjustment > 0"> service price <b class="text-green">increases</b> by </span>
                                <span v-else-if="pricingRule.adjustment < 0"> service price <b class="text-red">decreases</b> by </span>
                                <span v-else> service price remains unchanged: </span>

                                <InlineTextField v-model="pricingRule.adjustment" prefix="A$">
                                    <template v-slot:activator="{ activatorProps }">
                                        <span v-bind="activatorProps" class="text-primary cursor-pointer"><b><u>{{ formatPrice(Math.abs(pricingRule.adjustment)) }}</u></b></span>
                                    </template>
                                </InlineTextField>

                                <template v-slot:append>
                                    <v-btn variant="text" color="red"
                                           @click="priceAdjustmentRecord.id ? priceAdjustmentRecord.removeRule(index) : priceAdjustmentRule.removeRule(index)">
                                        <v-icon color="red">mdi-close</v-icon>
                                    </v-btn>
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
                            <v-btn @click="proceed()" v-if="!priceAdjustmentRule.currentSession.id">Create Rules</v-btn>
                            <template v-else>
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
                            </template>
                        </v-btn-group>
                    </v-col>
                </v-form>
            </v-container>
        </v-card>
    </v-dialog>
</template>

<style scoped>

</style>