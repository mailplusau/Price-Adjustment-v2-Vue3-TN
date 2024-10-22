<script setup>
import { useGlobalDialog } from "@/stores/global-dialog";
import { useFranchiseeStore } from "@/stores/franchisees";
import { useMainStore } from "@/stores/main";

const props = defineProps(['params'])
const globalDialog = useGlobalDialog();
const franchiseeStore = useFranchiseeStore();
const mainStore = useMainStore();

async function loadFranchisee() {
    const message = props.params.data['adjustmentRecord'] ?
        `Would you like to load Price Adjustment Data of franchisee ${props.params.data['companyname']}?` :
        `<b class="text-red">Warning: </b> Franchisee has not start their session. `
        + `By loading their data, you will initiate their session on their behalf. Would you like to continue?`;

    const res = await globalDialog.displayConfirmation('Prepare to load data', message);

    if (!res) return;

    globalDialog.displayProgress('', 'Retrieving Franchisee\'s Information...');
    mainStore.mainPage.current = mainStore.mainPage.options.PRICE_ADJ;
    await franchiseeStore.changeCurrentFranchiseeId(props.params.data['internalid']);
    globalDialog.close(100, 'Complete!').then();
}
</script>

<template>
    <div class="text-center">
        <v-btn size="x-small" variant="elevated" color="green" @click="loadFranchisee()" class="mb-1">
            Load Data
        </v-btn>
    </div>
</template>

<style scoped>

</style>