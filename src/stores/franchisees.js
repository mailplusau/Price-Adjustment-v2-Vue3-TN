import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';
import {franchisee as franchiseeFields} from 'netsuite-shared-modules'
import { useUserStore } from "@/stores/user";
import { franchisees } from "@/utils/testData";
import { usePriceAdjustment } from "@/stores/price-adjustment";

const state = {
    all: [],
    busy: false,

    current: {
        id: null,
        details: {...franchiseeFields},
        texts: {...franchiseeFields},
        priceAdjustmentData: [],
    }
};

const getters = {

};

const actions = {
    async init() {
        if (useUserStore().isFranchisee) this.current.id = useUserStore().id;

        await Promise.allSettled([
            _fetchAll(this),
            _fetchCurrentFranchisee(this)
        ])
    },
    async changeCurrentFranchiseeId(franchiseeId) {
        if (this.all.findIndex(item => item.internalid === franchiseeId) < 0) return;

        this.current.id = franchiseeId;
        this.busy = true;
        await _fetchCurrentFranchisee(this);
        await usePriceAdjustment().init();
        this.busy = false;
    },
    resetCurrent() {
        this.current.id = null;
        this.details = {...franchiseeFields};
        this.texts = {...franchiseeFields};
    }
};

async function _fetchAll(ctx) {
    const data = await http.get('getAllFranchisees');
    ctx.all = Array.isArray(data) ? data : [...franchisees];
}

async function _fetchCurrentFranchisee(ctx) {
    if (!ctx.current.id) return;

    const franchiseeData = await http.get('getFranchiseeDetails', {franchiseeId: ctx.current.id});

    for (let fieldId in ctx.current.details) {
        ctx.current.details[fieldId] = franchiseeData[fieldId];
        ctx.current.texts[fieldId] = franchiseeData[fieldId + '_text'];
    }
}


export const useFranchiseeStore = defineStore('franchisees', {
    state: () => state,
    getters,
    actions,
});
