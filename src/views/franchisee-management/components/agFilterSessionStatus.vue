<script>
import { getSessionStatusFromAdjustmentRecord } from "@/utils/utils.mjs";

export default {
    props: {
        params: Object
    },
    data: () => ({
        active: false,
        condition: [0, 1, 2, 3, 4, 5, 6],
        options: [

        ]
    }),
    methods: {
        updateFilter() {
            this.params.filterChangedCallback();
        },
        doesFilterPass(params) {
            const statusObj = getSessionStatusFromAdjustmentRecord(params?.data?.adjustmentRecord)

            return this.condition.includes(statusObj.order);
        },
        isFilterActive() {
            return true;
        }
    }
}
</script>

<template>
    <div class="year-filter">
        <div>Select Session Status</div>
        <label>
            <input type="checkbox" name="statuses" v-model="condition" v-on:change="updateFilter()" :value="0"/> All services confirmed
        </label>
        <label>
            <input type="checkbox" name="statuses" v-model="condition" v-on:change="updateFilter()" :value="1"/> In Progress
        </label>
        <label>
            <input type="checkbox" name="statuses" v-model="condition" v-on:change="updateFilter()" :value="2"/> In Progress (0 confirmed)
        </label>
        <label>
            <input type="checkbox" name="statuses" v-model="condition" v-on:change="updateFilter()" :value="3"/> Initiated But No Progress
        </label>
        <label>
            <input type="checkbox" name="statuses" v-model="condition" v-on:change="updateFilter()" :value="4"/> Opted Out
        </label>
        <label>
            <input type="checkbox" name="statuses" v-model="condition" v-on:change="updateFilter()" :value="5"/> No Eligible Customer
        </label>
        <label>
            <input type="checkbox" name="statuses" v-model="condition" v-on:change="updateFilter()" :value="6"/> Not Started
        </label>
    </div>
</template>

<style scoped>
.year-filter {
    width: 200px;
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