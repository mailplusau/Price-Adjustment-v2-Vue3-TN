<script setup>
import { ref, defineModel, watch, nextTick, computed } from "vue";
import { checkSubset } from "@/utils/utils.mjs";
const model = defineModel({
    required: true,
});
const props = defineProps({
    readonly: {
        type: Boolean,
        default: false,
    },
    title: {
        type: String,
        default: 'Select an item'
    },
    disabled: {
        type: Boolean,
        default: false,
    },
    items: {
        type: Array,
        default: () => [],
    },
    itemTitle: {
        type: String,
        default: 'title',
    },
    itemValue: {
        type: String,
        default: 'value',
    },
    minWidth: {
        type: Number,
        default: 250
    }
})

const menuOpen = ref(false);
const inputValue = ref(null);
const mainInput = ref();
const selectedTitle = computed(() => {
    const index = props.items.findIndex(item => item[props.itemValue] === model.value);
    return index >= 0 ? props.items[index][props.itemTitle] : '';
})

function handleSelection() {
    menuOpen.value = false;
}

watch(menuOpen, (val) => {
    if (val) {
        let index = props.items.findIndex(item => Array.isArray(item[props.itemValue])
            ? (checkSubset(item[props.itemValue], model.value) && checkSubset(model.value, item[props.itemValue]))
            : (item[props.itemValue] === model.value));

        inputValue.value = props.items[index];

        nextTick(() => {
            setTimeout(() => {
                mainInput.value.focus();
            }, 50)
        })
    } else model.value = inputValue.value?.[props.itemValue] || model.value;
})

</script>

<template>
    <v-menu :close-on-content-click="false" v-model="menuOpen" location="bottom center">
        <template v-slot:activator="{ props: activatorProps }">
            <slot name="activator" :activatorProps="props.disabled ? null : activatorProps" :readonly="props.readonly" :selectedTitle="selectedTitle"></slot>
        </template>
        <v-card :min-width="props.minWidth" color="background">
            <v-autocomplete density="compact" hide-details variant="outlined" color="primary" :menu="true"
                            :items="props.items" :item-value="props.itemValue" :item-title="props.itemTitle"
                            :prefix="props.prefix" @update:model-value="handleSelection" return-object
                            ref="mainInput" v-model="inputValue"></v-autocomplete>
        </v-card>
    </v-menu>
</template>

<style scoped>

</style>