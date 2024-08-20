<script setup>
import {useMainStore} from '@/stores/main';
import {useUserStore} from '@/stores/user';

const mainStore = useMainStore();
const userStore = useUserStore();

const userRoles = [
    {title: 'Admin (3)', value: 3},
    {title: 'Data Admin (1032)', value: 1032},
    {title: 'Franchisee (1000)', value: 1000},
    {title: 'BDM', value: -1},
]
</script>

<template>
    <v-fab icon="mdi-chevron-left" size="small" v-if="userStore.id === 1732844"
           @click="mainStore.dev.sidebar = !mainStore.dev.sidebar"
           style="position: fixed; right: 60px; top: 35px;"></v-fab>

    <v-navigation-drawer v-model="mainStore.dev.sidebar" temporary location="right" width="300" class="bg-background">

        <v-list density="compact" nav>
            <v-list-subheader>User</v-list-subheader>
            <v-list-item>
                <v-autocomplete density="compact" color="primary" label="User Role"
                                v-model="userStore.role"
                                :items="userRoles"
                                hide-details class="mt-2"
                                variant="outlined"></v-autocomplete>
            </v-list-item>

            <v-divider class="mt-3"></v-divider>

            <v-list-subheader>Miscellaneous</v-list-subheader>
            <v-list-item>

            </v-list-item>
        </v-list>
    </v-navigation-drawer>
</template>

<style scoped>

</style>