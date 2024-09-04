import { produce } from 'immer';
import { State, TransactionQueue } from './types';

const initialTransactionQueue: TransactionQueue = {
    pending: [],
    processing: [],
};

const initialState: State = {
    accounts: [],
    transactionQueue: initialTransactionQueue,
    api: null,
};

let currentState = initialState;

export const getState = () => currentState;

export const updateState = (recipe: (draft: State) => void) => {
    currentState = produce(currentState, recipe);
};
