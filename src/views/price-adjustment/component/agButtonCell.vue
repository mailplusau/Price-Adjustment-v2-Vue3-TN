<script setup>
const props = defineProps(['params'])

function confirm() {
    props.params.node.setDataValue('confirmed', true);
}
</script>

<template>
    <div class="text-center">
        <b v-if="props?.params?.value">
            <v-icon size="small">mdi-check</v-icon> Confirmed
        </b>
        <v-btn v-else size="x-small" variant="elevated" color="green" @click="confirm" class="mb-1">
            Confirm
        </v-btn>
    </div>
</template>

<style scoped>

</style>