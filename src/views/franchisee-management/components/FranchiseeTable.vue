<script setup>
import { AgGridVue } from "ag-grid-vue3";
import agFranchiseeSessionStatus from '@/views/franchisee-management/components/agFranchiseeSessionStatus.vue';
import agControlCell from '@/views/franchisee-management/components/agControlCell.vue';
import agFilterSessionStatus from "@/views/franchisee-management/components/agFilterSessionStatus.vue";
import { computed, ref, shallowRef, watch } from "vue";
import { useFranchiseeManager } from "@/stores/franchisee-manager";
import AgFMTableContextMenu from "@/views/franchisee-management/components/agFMTableContextMenu.vue";
import { getSessionStatusFromAdjustmentRecord } from "@/utils/utils.mjs";
import { parse } from 'date-fns';

const franchiseeManager = useFranchiseeManager();
const props = defineProps(['searchText']);
const contextMenu = ref();
const gridApi = shallowRef();

const rowData = computed({
    get() {
        return franchiseeManager.all;
    },
    set(val) {
        if (Array.isArray(val)) {
            for (let [index, value] of val.entries())
                franchiseeManager.all.splice(index, 1, value)

            franchiseeManager.all.splice(val.length);
        }
    }
})

const onGridReady = (params) => {
    gridApi.value = params.api;
    gridApi.value.applyColumnState({
        state: [{ colId: "sessionStatus", sort: "asc" }],
        defaultState: { sort: null },
    });
};

const columnDefs = [
    {
        headerName: "#", width: '50px', pinned: 'left', cellClass: ['ag-left-pinned-col', 'text-center'], headerClass: 'text-center',
        valueGetter: params => {
            return params.node.rowIndex;
        }
    },
    {
        headerName: 'ID', editable: false, filter: true, width: '80px', field: 'internalId'.toLowerCase()
    },
    {
        headerName: 'Franchisee Name', editable: false, filter: true, width: '280px', field: 'companyName'.toLowerCase()
    },
    {
        headerName: 'Session Status', editable: false, filter: 'agFilterSessionStatus', width: '250px', cellRenderer: 'agFranchiseeSessionStatus',
        field: 'sessionStatus',
        valueGetter: params => getSessionStatusFromAdjustmentRecord(params?.data?.adjustmentRecord),
        comparator: (valueA, valueB) => `${valueA.order}`.localeCompare(`${valueB.order}`)
    },
    {
        headerName: 'Last Modified', editable: false, filter: true, width: '150px',
        valueGetter: params => {
            return params?.data?.adjustmentRecord ? params?.data?.adjustmentRecord['lastModified'.toLowerCase()] : '--';
        },
        comparator: (valueA, valueB, nodeA, nodeB, isDescending) => {
            const dateA = valueA === '--' ? (isDescending ? 0 : Number.MAX_VALUE) : parse(valueA, 'd/M/y h:m a', new Date());
            const dateB = valueB === '--' ? (isDescending ? 0 : Number.MAX_VALUE) : parse(valueB, 'd/M/y h:m a', new Date());

            return dateA - dateB;
        }
    },
    {
        headerName: 'By', editable: false, filter: true, width: '160px',
        valueGetter: params => {
            return params?.data?.adjustmentRecord ? params?.data?.adjustmentRecord['lastModifiedBy_text'.toLowerCase()] : '--';
        }
    },
    {
        headerName: '', editable: false, filter: false, width: '110px', resizable: false, cellRenderer: 'agControlCell'
    },
];

function handleCellMouseDown(e) {
    contextMenu.value.handleCellMouseDown(e);
}

watch(() => props.searchText, val => {
    gridApi.value.setGridOption("quickFilterText", val,);
})

defineExpose({agControlCell, agFranchiseeSessionStatus, agFilterSessionStatus});
</script>

<template>
    <ag-grid-vue style="width: 100%; height: 100%;" ref="agGrid"
                 class="ag-theme-custom"
                 :stopEditingWhenCellsLoseFocus="true"
                 :columnDefs="columnDefs"
                 :preventDefaultOnContextMenu="true"
                 :getRowClass="params => params.data.highlightClass"
                 :enableCellTextSelection="true"
                 @gridReady="onGridReady"
                 @cellMouseDown="handleCellMouseDown"
                 v-model="rowData">
    </ag-grid-vue>

    <agFMTableContextMenu ref="contextMenu"/>
</template>

<style scoped>

</style>