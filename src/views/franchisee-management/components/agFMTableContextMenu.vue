<script setup>

import { nextTick, ref } from "vue";
import { useFranchiseeManager } from "@/stores/franchisee-manager";

let gridApi = null;
const franchiseeManager = useFranchiseeManager();

const contextMenu = ref({
    x: 0,
    y: 0,
    show: false,
    data: null,
})

function handleCellMouseDown(cellMouseDownEvent) {
    if (cellMouseDownEvent.event.type === 'mousedown' && cellMouseDownEvent.event.button === 2) {
        cellMouseDownEvent.event.stopPropagation();
        cellMouseDownEvent.event.preventDefault();

        gridApi = cellMouseDownEvent.api;
        contextMenu.value.show = false
        contextMenu.value.data = {...cellMouseDownEvent.data}
        contextMenu.value.x = cellMouseDownEvent.event.clientX
        contextMenu.value.y = cellMouseDownEvent.event.clientY
        nextTick(() => { contextMenu.value.show = true; })
    }
}

function toggleActiveStatus() {
    if (!contextMenu.value.data['adjustmentRecord']) return;

    console.log('toggleActiveStatus', contextMenu.value.data)
    franchiseeManager.toggleActiveStatusOfAdjustmentRecord(contextMenu.value.data['adjustmentRecord']);
}

defineExpose({handleCellMouseDown})
</script>

<template>
    <v-menu min-width="100" location="bottom start" location-strategy="connected"
            v-model="contextMenu.show" :target="[contextMenu.x, contextMenu.y]">

        <v-list density="compact" bg-color="primary" class="pa-0">
            <v-list-item>
                Franchisee <b class="text-secondary">{{ contextMenu.data['companyName'.toLowerCase()] }}</b>
            </v-list-item>


            <v-divider></v-divider>

            <v-list-item class="text-caption" @click="toggleActiveStatus()">
                Session status:&nbsp;
                <span v-if="!contextMenu.data['adjustmentRecord']"><b class="text-grey">Not Started</b></span>
                <span v-else-if="contextMenu.data['adjustmentRecord'].custrecord_1302_opt_out_reason">
                    <b class="text-red">Opted out</b> (click to reinstate)
                </span>
                <span v-else><b class="text-green">Active</b> (click to opt-out)</span>
            </v-list-item>
            <v-list-item class="text-caption" v-if="contextMenu.data['adjustmentRecord']?.custrecord_1302_opt_out_reason">
                Reason: <span class="text-grey">{{contextMenu.data['adjustmentRecord'].custrecord_1302_opt_out_reason}}</span>
            </v-list-item>
        </v-list>
    </v-menu>
</template>

<style scoped>

</style>