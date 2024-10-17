<script setup>
import { computed, ref } from "vue";
import DatePicker from "@/components/shared/DatePicker.vue";
import { usePricingRules } from "@/stores/pricing-rules";
import { useGlobalDialog } from "@/stores/global-dialog";
import { useUserStore } from "@/stores/user";
import { usePriceAdjustment } from "@/stores/price-adjustment";
import PricingRuleEditor from "@/views/price-adjustment/rule-dialog/components/PricingRuleEditor.vue";

const globalDialog = useGlobalDialog();
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
const priceAdjustmentRecordActive = computed({
    get: () => !priceAdjustmentRecord.form.custrecord_1302_opt_out_reason,
    set: val => priceAdjustmentRecord.form.custrecord_1302_opt_out_reason = val ? '' : `Opted out by ${userStore.name}`,
})

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
            <v-col cols="12" class="text-center text-primary">
                <span class="text-h6">Price Adjustment Data of</span><br><u class="text-h5">{{ priceAdjustmentRecord.texts.custrecord_1302_franchisee }}</u>
            </v-col>

            <template v-if="userStore.isAdmin">
                <v-col cols="12">
                    <v-switch color="green" inset
                        v-model="priceAdjustmentRecordActive"
                        :label="priceAdjustmentRecordActive ? 'Active (click to opt out)' : 'Opted out (click to reinstate)'"
                        hide-details
                    ></v-switch>

                    <p v-show="!priceAdjustmentRecordActive"><b>Opt-out Reason:</b> <i>{{priceAdjustmentRecord.form.custrecord_1302_opt_out_reason}}</i></p>
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
                <PricingRuleEditor v-model="servicePricingRules" :show-restore-default="true" />
            </v-col>

            <v-col cols="auto">
                <v-btn @click="dialogOpen = false">cancel</v-btn>
            </v-col>

            <v-col cols="auto">
                <v-btn color="primary" @click="proceed()">Save</v-btn>
            </v-col>

            <v-col cols="auto">
                <v-btn color="green" @click="proceed(true)">Save & Apply Rules</v-btn>
            </v-col>
        </v-form>
    </v-container>
</template>

<style scoped>

</style>