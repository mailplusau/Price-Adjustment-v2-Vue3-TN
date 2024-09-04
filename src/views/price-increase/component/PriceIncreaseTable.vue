<script setup>
import { AgGridVue } from "ag-grid-vue3"; // Vue Data Grid Component
import { computed } from "vue";
import { usePriceIncreaseStore } from "@/stores/price-increase";
import agButtonCell from '@/views/price-increase/component/agButtonCell.vue';
import agFilterConfirmedColumn from '@/views/price-increase/component/agFilterConfirmedColumn.vue';
import { formatPrice } from "@/utils/utils.mjs";


const piProcessor = usePriceIncreaseStore();

const rowData = computed({
    get() {
        return piProcessor.currentSession.franchiseeData;
    },
    set(val) {
        if (Array.isArray(val)) {
            for (let [index, value] of val.entries())
                piProcessor.currentSession.franchiseeData.splice(index, 1, value)

            piProcessor.currentSession.franchiseeData.splice(val.length);
        }
    }
})

const columnDefs = [
    {
        headerName: "#", width: '50px', pinned: 'left', cellClass: ['ag-left-pinned-col', 'text-center'], headerClass: 'text-center',
        valueGetter: params => {
            return params.node.rowIndex;
        }
    },
    {
        field: 'custrecord_1288_notes', headerName: 'Customer', editable: false, filter: true, width: '300px',
        valueGetter: params => `${params.data['CUSTRECORD_SERVICE_CUSTOMER.entityid']} ${params.data['CUSTRECORD_SERVICE_CUSTOMER.companyname']}`
    },
    {
        field: 'custrecord_service_text', headerName: 'Service', editable: false, filter: true, width: '150px',
    },
    {
        field: 'custrecord_service_price', headerName: 'Current Price', editable: false, filter: true, width: '150px',
        valueGetter: params => formatPrice(params.data['custrecord_service_price'])
    },
    {
        field: 'adjustment', headerName: 'Adjustment', editable: true, filter: true, width: '120px', cellEditor: 'agNumberCellEditor',
        valueGetter: params => parseFloat(params.data.adjustment),
        valueSetter: params => {
            const previousValue = params.data.adjustment;
            params.data.adjustment = isNaN(parseFloat(params.newValue)) ? 0 : parseFloat(params.newValue);
            if (previousValue !== params.data.adjustment) params.data.confirmed = false;
            return true;
        },
    },
    {
        headerName: 'New Price', editable: false, filter: true, width: '120px',
        valueGetter: params => formatPrice(parseFloat(params.data.adjustment) + parseFloat(params.data['custrecord_service_price']))
    },
    {
        field: 'confirmed', headerName: '', editable: false, filter: 'agFilterConfirmedColumn', width: '100px', cellRenderer: 'agButtonCell',
        valueGetter: params => params.data['confirmed']
    },
    //{ field: 'confirmed', headerName: "", width: '100px', pinned: 'right', cellRenderer: 'agButtonCell', cellClass: 'ag-right-pinned-col', selectable: false, },
];

defineExpose({agButtonCell, agFilterConfirmedColumn})
</script>

<template>
    <ag-grid-vue style="width: 100%; height: 100%;" ref="agGrid"
                 class="ag-theme-custom"
                 :stopEditingWhenCellsLoseFocus="true"
                 :columnDefs="columnDefs"
                 :preventDefaultOnContextMenu="true"
                 :getRowClass="params => params.data.highlightClass"
                 v-model="rowData">
    </ag-grid-vue>
    <agButtonCell />
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