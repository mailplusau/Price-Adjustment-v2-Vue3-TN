<script setup>
import {ref, defineModel, watch, nextTick} from "vue";

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
        default: 'Select a date'
    },
    disabled: {
        type: Boolean,
        default: false,
    },
    prefix: {
        type: String,
        default: ''
    },
    minWidth: {
        type: Number,
        default: 250
    }
})

const inputValue = ref('');
const menuOpen = ref(false);
const mainInput = ref();

watch(menuOpen, (val) => {
    if (val) {
        inputValue.value = model.value;
        nextTick(() => {
            setTimeout(() => { mainInput.value.focus(); }, 50)
        })
    } else model.value = isNaN(parseFloat(inputValue.value)) ? 0: parseFloat(inputValue.value);
})
</script>

<template>
    <v-menu :close-on-content-click="false" v-model="menuOpen" location="bottom center">
        <template v-slot:activator="{ props: activatorProps }">
            <slot name="activator" :activatorProps="props.disabled ? null : activatorProps" :readonly="props.readonly"></slot>
        </template>
        <v-card :min-width="props.minWidth" color="background">
            <v-text-field density="compact" hide-details variant="outlined" color="primary" type="number" hide-spin-buttons step="0.01"
                          :prefix="props.prefix"
                          ref="mainInput" v-model="inputValue"></v-text-field>
        </v-card>
    </v-menu>
</template>

<style scoped>

</style>