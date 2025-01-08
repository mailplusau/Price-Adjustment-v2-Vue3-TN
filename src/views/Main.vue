<script setup>
import SessionBrowser from '@/views/session-browser/Main.vue';
import PriceAdjustmentMainView from "@/views/price-adjustment/Main.vue";
import FranchiseeManagementMainView from '@/views/franchisee-management/Main.vue';
import { useMainStore } from "@/stores/main";

const mainStore = useMainStore();
</script>

<template>
    <v-fade-transition>
        <PriceAdjustmentMainView v-if="mainStore.mainPage.current === mainStore.mainPage.options.PRICE_ADJ" />
    </v-fade-transition>

    <v-fade-transition>
        <FranchiseeManagementMainView v-if="mainStore.mainPage.current === mainStore.mainPage.options.FRANCHISEE_MGMT" />
    </v-fade-transition>

    <SessionBrowser />
</template>

<style scoped>

</style>