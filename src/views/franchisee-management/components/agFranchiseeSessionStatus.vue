<script setup>
const props = defineProps(['params'])
</script>

<template>
    <div class="text-center">
        <b :class="props.params.value.text">{{ props.params.value.status }}</b>
    </div>
</template>

<style scoped>

</style>