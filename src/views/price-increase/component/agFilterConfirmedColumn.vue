<script setup>
import { ref } from "vue";

const props = defineProps(['params']);
const condition = ref(-1);

function updateFilter() {
    props.params.filterChangedCallback();
}

// eslint-disable-next-line no-unused-vars
function doesFilterPass(params) {
    if (condition.value === 1)
        return params.data.confirmed;

    if (condition.value === 0)
        return !params.data.confirmed;

    return true;
}

// eslint-disable-next-line no-unused-vars
function isFilterActive() {
    return this.condition !== -1;
}
</script>

<template>
    <div class="year-filter">
        <div>Select Confirmation Status</div>
        <label>
            <input type="radio" name="year" v-model="condition" v-on:change="updateFilter()" :value="-1"/> All
        </label>
        <label>
            <input type="radio" name="year" v-model="condition" v-on:change="updateFilter()" :value="1"/> Confirmed
        </label>
        <label>
            <input type="radio" name="year" v-model="condition" v-on:change="updateFilter()" :value="0"/> Not Confirmed
        </label>
    </div>
</template>

<style scoped>
.year-filter {
    width: 250px;
}

.year-filter > * {
    margin: 8px;
}

.year-filter > div:first-child {
    font-weight: bold;
}

.year-filter > label {
    display: inline-block;
}
</style>