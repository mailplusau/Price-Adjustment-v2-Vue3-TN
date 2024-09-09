<script setup>
import { AgGridVue } from "ag-grid-vue3"; // Vue Data Grid Component
import { computed, ref, shallowRef, watch } from "vue";
import agButtonCell from '@/views/price-increase/component/agButtonCell.vue';
import agFilterConfirmedColumn from '@/views/price-increase/component/agFilterConfirmedColumn.vue';
import { debounce, formatPrice } from "@/utils/utils.mjs";
import { usePriceAdjustment } from "@/stores/price-adjustment";
import AgContextMenu from "@/views/price-increase/component/agContextMenu.vue";

const priceAdjustment = usePriceAdjustment();

const props = defineProps(['searchText']);
const contextMenu = ref();
const gridApi = shallowRef();

const rowData = computed({
    get() {
        return priceAdjustment.priceAdjustmentData;
    },
    set(val) {
        if (Array.isArray(val)) {
            for (let [index, value] of val.entries())
                priceAdjustment.priceAdjustmentData.splice(index, 1, value)

            priceAdjustment.priceAdjustmentData.splice(val.length);
        }
    }
})

const onGridReady = (params) => {
    gridApi.value = params.api;
};

const onDataChanged = async () => {
    await priceAdjustment.savePriceAdjustmentRecord();
}

const debouncedSave = debounce(onDataChanged, 1000, {trailing: true, leading: false});

const columnDefs = [
    {
        headerName: "#", width: '50px', pinned: 'left', cellClass: ['ag-left-pinned-col', 'text-center'], headerClass: 'text-center',
        valueGetter: params => {
            return params.node.rowIndex;
        }
    },
    {
        headerName: 'ID', editable: false, filter: true, width: '80px',
        valueGetter: params => params.data['CUSTRECORD_SERVICE_CUSTOMER.entityid']
    },
    {
        headerName: 'Customer', editable: false, filter: true, width: '280px',
        valueGetter: params => params.data['CUSTRECORD_SERVICE_CUSTOMER.companyname']
    },
    {
        field: 'custrecord_service_text', headerName: 'Service', editable: false, filter: true, width: '150px',
    },
    {
        headerName: 'Current Price', editable: false, filter: true, width: '150px',
        valueGetter: params => formatPrice(params.data['custrecord_service_price'])
    },
    {
        field: 'adjustment', headerName: 'Adjustment', editable: true, filter: true, width: '120px', cellEditor: 'agNumberCellEditor',
        valueGetter: params => parseFloat(params.data.adjustment),
        valueSetter: params => {
            const previousValue = params.data.adjustment;
            params.data.adjustment = isNaN(parseFloat(params.newValue)) ? 0 : parseFloat(params.newValue);
            if (previousValue !== params.data.adjustment) params.data.confirmed = false;
            debouncedSave();
            return true;
        },
    },
    {
        headerName: 'New Price', editable: false, filter: true, width: '120px', enableCellChangeFlash: true,
        valueGetter: params => formatPrice(parseFloat(params.data.adjustment) + parseFloat(params.data['custrecord_service_price']))
    },
    {
        field: 'confirmed', headerName: '', editable: false, filter: 'agFilterConfirmedColumn', width: '100px', cellRenderer: 'agButtonCell',
        valueGetter: params => params.data['confirmed'],
        valueSetter: params => {
            params.data.confirmed = params.newValue;
            debouncedSave();
            return true;
        },
    },
    //{ field: 'confirmed', headerName: "", width: '100px', pinned: 'right', cellRenderer: 'agButtonCell', cellClass: 'ag-right-pinned-col', selectable: false, },
];

function handleCellMouseDown(e) {
    contextMenu.value.handleCellMouseDown(e);
}

watch(() => props.searchText, val => {
    gridApi.value.setGridOption("quickFilterText", val,);
})

defineExpose({agButtonCell, agFilterConfirmedColumn})
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

    <agContextMenu ref="contextMenu" />
</template>

<style lang="scss">
.v-data-table_row_has_error {
    background-color: white;
    color: red;
}
.v-data-table_row_cursor_pointer {
    cursor: pointer;
}
.ag-left-pinned-col {
    box-shadow: #095c7b42 0px 0px 7px inset;
    //border-right: 2px solid #00314469 !important;
}
.ag-right-pinned-col {
    box-shadow: #095c7b42 0px 0px 7px inset;
    //border-left: 2px solid #00314469 !important;
}

@import '@/assets/ag-grid-theme-builder.css';
</style>