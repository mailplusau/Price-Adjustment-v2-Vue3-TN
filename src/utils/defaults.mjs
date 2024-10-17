export const priceAdjustmentConditions = [
    {}
]

export const priceAdjustmentTerms = {
    CURRENT_PRICE: {
        title: 'Current Price', value: 'current_price'
    },


}

export const operators = {
    EQ: {
        title: 'Equal', value: '='
    },
    NEQ: {
        title: 'Not equal', value: '!='
    },
    LT: {
        title: 'Less than', value: '<'
    },
    LTE: {
        title: 'Less than or equal', value: '<='
    },
    GT: {
        title: 'Greater than', value: '>'
    },
    GTE: {
        title: 'Greater than or equal', value: '>='
    }
}

export const priceAdjustmentTypes = {
    AMOUNT: {
        name: 'amount',
        selectorTitle: 'by a given amount',
    },
    PERCENT: {
        name: 'percentage',
        selectorTitle: 'by a percentage',
    },
    FIXED: {
        name: 'fixed',
        selectorTitle: 'to a target rate',
    }
}