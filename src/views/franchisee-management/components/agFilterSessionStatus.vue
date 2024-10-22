<script>
export default {
    props: {
        params: Object
    },
    data: () => ({
        condition: -1
    }),
    methods: {
        updateFilter() {
            this.params.filterChangedCallback();
        },
        doesFilterPass(params) {
            if (this.condition === 1)
                return params.data.confirmed;

            if (this.condition === 0)
                return !params.data.confirmed;

            return true;
        },
        isFilterActive() {
            return this.condition !== -1;
        }
    }
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