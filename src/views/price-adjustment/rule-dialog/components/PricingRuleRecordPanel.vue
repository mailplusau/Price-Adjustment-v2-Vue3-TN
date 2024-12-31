<script setup>
import { computed, ref } from "vue";
import { rules } from "@/utils/utils.mjs";
import { set, addDays } from 'date-fns';
import DatePicker from "@/components/shared/DatePicker.vue";
import { usePricingRules } from "@/stores/pricing-rules";
import { useGlobalDialog } from "@/stores/global-dialog";
import { useUserStore } from "@/stores/user";
import PricingRuleEditor from "@/views/price-adjustment/rule-dialog/components/PricingRuleEditor.vue";

const globalDialog = useGlobalDialog();
const userStore = useUserStore();

const priceAdjustmentRule = usePricingRules();

const { validate } = rules;
const mainForm = ref(null);
const formValid = ref(true);
const servicePricingRules = computed(() =>
    Object.prototype.toString.call(priceAdjustmentRule.currentSession.form.custrecord_1301_pricing_rules) !== '[object Array]'
        ? [] : priceAdjustmentRule.currentSession.form.custrecord_1301_pricing_rules);
const dialogOpen = computed({
    get: () => priceAdjustmentRule.pricingRuleDialog.open,
    set: val => { priceAdjustmentRule.pricingRuleDialog.open = val; }
});

const minDeadline = computed(() => !priceAdjustmentRule.currentSession.form.custrecord_1301_opening_date
    ? '' : set(priceAdjustmentRule.currentSession.form.custrecord_1301_opening_date, {hours: 14, minutes: 0, seconds: 0, milliseconds: 0}).toISOString());

const minEffectiveDate = computed(() => !priceAdjustmentRule.currentSession.form.custrecord_1301_deadline
    ? '' : set(addDays(priceAdjustmentRule.currentSession.form.custrecord_1301_deadline, 15), {hours: 14, minutes: 0, seconds: 0, milliseconds: 0}).toISOString());

async function proceed() {
    let res = await mainForm.value['validate']();
    if (!res.valid) return console.log('Fix the errors');

    globalDialog.displayProgress('', 'Saving Pricing Rule Record...');

    if (priceAdjustmentRule.currentSession.id) await priceAdjustmentRule.savePricingRules();
    else await priceAdjustmentRule.createNewRuleRecord();

    await globalDialog.close(500, 'Complete!');
    dialogOpen.value = false;
}
</script>

<template>
    <v-container fluid v-if="userStore.isAdmin">
        <v-form class="v-row justify-center" ref="mainForm" v-model="formValid">
            <v-col cols="12" class="text-h5 text-center text-red font-weight-bold">Pricing Rule Master Record</v-col>

            <v-col cols="4" class="mb-4">
                <DatePicker v-model="priceAdjustmentRule.currentSession.form.custrecord_1301_opening_date" title="Opening Date"
                            @update:model-value="priceAdjustmentRule.handleDatesChanged">
                    <template v-slot:activator="{ activatorProps, displayDate }">
                        <v-text-field v-bind="priceAdjustmentRule.isSessionFinalised ? null : activatorProps"
                                      :model-value="displayDate" persistent-placeholder readonly
                                      :rules="[v => validate(v, 'required')]"
                                      label="Opening Date" variant="outlined" density="compact" color="primary" hide-details></v-text-field>
                    </template>
                </DatePicker>
            </v-col>
            <v-col cols="4" class="mb-4">
                <DatePicker v-model="priceAdjustmentRule.currentSession.form.custrecord_1301_deadline" title="Deadline" :min="minDeadline"
                            :disabled="!priceAdjustmentRule.currentSession.form.custrecord_1301_opening_date"
                            @update:model-value="priceAdjustmentRule.handleDatesChanged" :readonly="priceAdjustmentRule.isSessionFinalised">
                    <template v-slot:activator="{ activatorProps, displayDate, disabled }">
                        <v-text-field v-bind="priceAdjustmentRule.isSessionFinalised ? null : activatorProps"
                                      :model-value="displayDate" persistent-placeholder readonly
                                      :rules="[v => validate(v, 'required')]" :disabled="disabled"
                                      label="Deadline" variant="outlined" density="compact" color="primary" hide-details></v-text-field>
                    </template>
                </DatePicker>
            </v-col>
            <v-col cols="4" class="mb-4">
                <DatePicker v-model="priceAdjustmentRule.currentSession.form.custrecord_1301_effective_date" title="Effective Date" :min="minEffectiveDate"
                            :disabled="!priceAdjustmentRule.currentSession.form.custrecord_1301_deadline"
                            @update:model-value="priceAdjustmentRule.handleDatesChanged" :readonly="priceAdjustmentRule.isSessionFinalised">
                    <template v-slot:activator="{ activatorProps, displayDate, disabled }">
                        <v-text-field v-bind="priceAdjustmentRule.isSessionFinalised ? null : activatorProps"
                                      :model-value="displayDate" persistent-placeholder readonly
                                      :rules="[v => validate(v, 'required')]" :disabled="disabled"
                                      label="Effective Date" variant="outlined" density="compact" color="primary" hide-details></v-text-field>
                    </template>
                </DatePicker>
            </v-col>

            <v-divider></v-divider>

            <v-col cols="12">
                <PricingRuleEditor v-model="servicePricingRules" />
            </v-col>

            <v-col cols="auto">
                <v-btn-group variant="elevated" divided density="compact">
                    <v-btn @click="dialogOpen = false">cancel</v-btn>
                </v-btn-group>
            </v-col>

            <v-col cols="auto" v-if="!priceAdjustmentRule.isSessionFinalised">
                <v-btn-group variant="elevated" color="green" divided density="compact">
                    <v-btn @click="proceed()" v-if="!priceAdjustmentRule.currentSession.id">Create Rules</v-btn>
                    <v-btn v-else size="small" @click="proceed()">Save Rules</v-btn>
                </v-btn-group>
            </v-col>
        </v-form>
    </v-container>
</template>

<style scoped>

</style>