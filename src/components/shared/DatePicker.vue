<script setup>
import {ref, defineModel, computed, watch, defineEmits} from "vue";
const model = defineModel({
    required: true,
});
const emit = defineEmits(['dateChanged']);
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
    min: {
        type: String,
        default: '',
    },
    clearable: {
        type: Boolean,
        default: false,
    }
})
const dialogOpen = ref(false);
const selectedDate = ref();

const dateFormat = new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'long',
    timeZone: 'Australia/Sydney',
});

function update() {
    dialogOpen.value = false;
    const shiftedSelectedDate = setTimeTo4AMLocal(selectedDate.value);
    if (model.value === shiftedSelectedDate) return;
    model.value = shiftedSelectedDate;
    emit('dateChanged', shiftedSelectedDate);
}

function clearInput() {
    model.value = '';
    selectedDate.value = null;
}

function setTimeTo4AMLocal(dateObject) {
    const year = `${dateObject.getFullYear()}`;
    const month = `${dateObject.getMonth() + 1}`.padStart(2, '0');
    const day = `${dateObject.getDate()}`.padStart(2, '0');

    return new Date(`${year}-${month}-${day}T04:00:00`)
}

watch(dialogOpen, (val) => {
    if (val) selectedDate.value = model.value || (props.min ? new Date(props.min) : null) || null;
})

const displayDate = computed(() => model.value ? dateFormat.format(model.value) : '')
</script>

<template>
    <v-dialog width="unset" v-model="dialogOpen">
        <template v-slot:activator="{ props: activatorProps }">
            <slot name="activator" :activatorProps="props.disabled ? null : activatorProps" :clearable="props.clearable"
                  :displayDate="displayDate" :readonly="props.readonly" :disabled="props.disabled" :clearInput="clearInput"></slot>
        </template>

        <template v-slot:default="{  }">
            <v-date-picker v-model="selectedDate" class="bg-background" color="primary" :title="title" :min="props.min">
                <template v-slot:actions>
                    <v-btn @click="dialogOpen = false">cancel</v-btn>
                    <v-btn variant="elevated" color="green" @click="update">apply change</v-btn>
                </template>
            </v-date-picker>
        </template>
    </v-dialog>
</template>

<style scoped>

</style>