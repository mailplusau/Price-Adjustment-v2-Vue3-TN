<script setup>
import { useMainStore } from "@/stores/main";
import { usePricingRules } from "@/stores/pricing-rules";

const mainStore = useMainStore();
const pricingRules = usePricingRules();
</script>

<template>
    <v-menu min-width="100" location="bottom start" location-strategy="connected" open-on-hover>
        <template v-slot:activator="{ props: activatorProps }">
            <v-btn size="small"
                   v-bind="activatorProps" icon="mdi-menu">
            </v-btn>
        </template>

        <v-list density="compact" class="pa-0">
            <v-divider></v-divider>
            <v-list-subheader>Navigation Menu</v-list-subheader>

            <v-list-item class="" @click="mainStore.mainPage.current = mainStore.mainPage.options.PRICE_ADJ">
                Price Adjustment
            </v-list-item>

            <v-list-item class="" @click="mainStore.mainPage.current = mainStore.mainPage.options.FRANCHISEE_MGMT">
                Franchisee Management
            </v-list-item>

            <v-list-item class="" @click="mainStore.mainPage.current = mainStore.mainPage.options.BACKUP_MGMT">
                Backup Management
            </v-list-item>

            <v-list-item class="" @click="pricingRules.browserDialog.open = true">
                Session Browser
            </v-list-item>

            <v-divider></v-divider>
            <v-list-subheader>Miscellaneous</v-list-subheader>

            <v-list-item class="" @click="mainStore.addShortcut()">
                Add Shortcut
            </v-list-item>
        </v-list>
    </v-menu>
</template>

<style scoped>

</style>