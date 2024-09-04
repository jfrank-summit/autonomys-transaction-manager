import { produce } from 'immer';
import { State } from './types';

const initialState: State = {
    accounts: [],
    transactions: [],
    api: null,
};

let currentState = initialState;

export const getState = () => currentState;

export const updateState = (recipe: (draft: State) => void) => {
    currentState = produce(currentState, recipe);
};
