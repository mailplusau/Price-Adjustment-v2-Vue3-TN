<script setup>
import {ref} from 'vue';
import { usePriceAdjustment } from "@/stores/price-adjustment";

const priceAdjustmentRecord = usePriceAdjustment();

const optOutReason = ref('');
const dialogOpen = ref(false);
const mainForm = ref(null);
const formValid = ref(true);

async function proceed() {
    let res = await mainForm.value['validate']();
    if (!res.valid) return console.log('Fix the errors');

    dialogOpen.value = false;
    await priceAdjustmentRecord.optOutOfPriceAdjustments(optOutReason.value);
}

</script>

<template>
    <v-dialog v-model="dialogOpen" width="550">
        <template v-slot:activator="{ props: activatorProps }">
            <v-btn variant="elevated" color="red" size="small" class="mr-2" v-bind="activatorProps">
                opt out
            </v-btn>
        </template>

        <v-card class="bg-background v-container">
            <v-form class="v-row align-center justify-center" ref="mainForm" v-model="formValid" lazy-validation>
                <v-col cols="auto">
                    <h3 class="text-primary">Opting out of Price Increase</h3>
                </v-col>

                <v-col cols="12">
                    <p class="text-subtitle-2">
                        You are about to <b class="text-red">opt out of all price increase opportunities</b> for this period. Please provide us with a reason for this decision before proceeding.
                    </p>
                    <v-textarea variant="outlined" color="primary" label="Reason for opting out" rows="2" density="compact"
                                class="mt-2" v-model="optOutReason"
                                :rules="[v => !!v || 'Please provide a reason']"></v-textarea>
                </v-col>

                <v-col cols="auto" @click="dialogOpen = false">
                    <v-btn >Cancel</v-btn>
                </v-col>
                <v-col cols="auto">
                    <v-btn color="red" @click="proceed">proceed</v-btn>
                </v-col>
            </v-form>
        </v-card>
    </v-dialog>
</template>

<style scoped>

</style>