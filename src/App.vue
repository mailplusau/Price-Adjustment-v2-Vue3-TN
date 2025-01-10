<script setup>
import { onMounted } from "vue";
import { useMainStore } from "@/stores/main";
import GlobalDialog from "@/components/shared/GlobalDialog.vue";
import MainView from "@/views/Main.vue";
import DevSideBar from '@/views/dev/components/DevSideBar.vue';

const mainStore = useMainStore();

onMounted(() => {
    mainStore.init();
})
</script>

<template>
    <v-app class="bg-background">
        <v-main class="fill-height bg-background">
            <MainView/>
        </v-main>
    </v-app>

    <GlobalDialog />
</template>

<style lang="scss">
.v-list-item {
    min-height: 40px !important;
}
.v-list-item-title {
    font-size: .85rem !important;
    font-weight: 500;
}
.cell-text-size-11px {
    font-size: 11px !important;
}
.v-data-table__th {
    font-size: 0.775rem !important;
}
.v-text-field__prefix {
    font-weight: 600;
}

.cell-text-size {
    font-size: 11px !important;
}
.v-input.v-text-field-no-pl input {
    padding-left: 0 !important;
}
.v-input.v-text-field-primary-color-input input {
    color: #095c7b;
    font-weight: bold;
}

.v-table.v-table--fixed-header>.v-table__wrapper>table>thead>tr>th {
    background: rgb(var(--v-theme-background)) !important;
}
.v-table.v-table--fixed-header>.v-table__wrapper>table>thead>tr {
    box-shadow: 0 3px 10px #00000038;
}

// Scrollbar
*::-webkit-scrollbar {
    background: transparent;
    width: 8px;
    border: 1px solid #a5b4a5;
    border-radius: 10px;
}
*::-webkit-scrollbar:hover {
    background: linear-gradient(0deg, #b8c7b7 5%, #cfe0ce 50%, #b9c9b9 95%);
    /*background: linear-gradient(90deg, black, #3c3c3c);*/
    width: 8px;
}
*::-webkit-scrollbar-thumb {
    border-radius: 5px;
    background: radial-gradient(#095c7b 5%, #ffffff00 40%);
}
*::-webkit-scrollbar-thumb:hover {
    background: radial-gradient(white 5%, #095c7b 80%);
    border: 1px solid #c4c4c4;
}
*::-webkit-scrollbar-thumb:active {
    background-color: #484e51;
}
*::-webkit-scrollbar-corner {
    background-color: #181a1b;
}

// AG Grid
.ag-grid-highlight-00 {
    background-color: #c2e1c1;
}

.ag-grid-highlight-01 {
    background-color: #c1e1e0;
}
</style>