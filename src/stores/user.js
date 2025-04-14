import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';
import { useMainStore } from "@/stores/main";

const state = {
    id: 1732844,
    role: 1032,
    name: 'Me',

    salesRep: {
        id: -1,
        name: 'Test Account Manager',
    }
};

const getters = {
    isAdmin : state => [3, 1032, 1001, 1022].includes(state.role), // Mail Plus Finance Role (1001), Mail Plus Finance Manager (1022)
    isFranchisee : state => state.role === 1000,
    notAdminOrFranchisee : state => ![3, 1000, 1032].includes(state.role),
    isMe : state => state.id === 1732844,
};

const actions = {
    async init() {
        if (!top.location.href.includes('app.netsuite')) return;

        if (useMainStore().testMode) {
            this.role = 1000;
            this.id = 1669342; // Brisbane
            this.name = 'Adelaide CBD';
            return;
        }

        let {role, id, name, salesRep} = await http.get('getCurrentUserDetails');

        this.role = parseInt(role);
        this.id = parseInt(id);
        this.name = name;
        this.salesRep.id = salesRep.id ? parseInt(salesRep.id) : null;
        this.salesRep.name = salesRep.name || null;
    },
};


export const useUserStore = defineStore('user', {
    state: () => state,
    getters,
    actions,
});
