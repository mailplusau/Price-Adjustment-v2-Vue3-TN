<script setup>
import { useMainStore } from "@/stores/main";

const mainStore = useMainStore();
</script>

<template>
    <v-menu min-width="100" location="bottom start" location-strategy="connected">
        <template v-slot:activator="{ props: activatorProps }">
            <v-btn size="small"
                   v-bind="activatorProps" icon="mdi-menu">
            </v-btn>
        </template>

        <v-list density="compact" class="pa-0">
            <v-list-item>
                <b class="text-grey">Navigation Menu</b>
            </v-list-item>

            <v-divider></v-divider>

            <v-list-item class="" @click="mainStore.mainPage.current = mainStore.mainPage.options.PRICE_ADJ">
                Price Adjustment
            </v-list-item>

            <v-list-item class="" @click="mainStore.mainPage.current = mainStore.mainPage.options.FRANCHISEE_MGMT">
                Franchisee Management
            </v-list-item>
        </v-list>
    </v-menu>
</template>

<style scoped>

</style>