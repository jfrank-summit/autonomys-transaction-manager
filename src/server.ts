import express from 'express';
import { TransactionQueue, enqueueTransaction, Transaction, TransactionCall, getQueueLength } from './transactionQueue';
import { AccountPool, getNextAccount } from './accountPool';
import { ApiState } from './networkApi';
import { processTransactions } from './transactionProcessor';
import { ApiPromise } from '@polkadot/api';

export type ServerState = {
    transactionQueue: TransactionQueue;
    accountPool: AccountPool;
    apiState: ApiState;
    nonceMap: Map<string, number>;
};

type ServerContext = {
    getState: () => ServerState;
    setState: (newState: ServerState) => void;
};

const createTransactionHandler = (context: ServerContext) => (req: express.Request, res: express.Response) => {
    const { module, method, params } = req.body;

    if (!module || !method || !params) {
        console.log('Invalid request: module, method, or params is missing');
        return res.status(400).json({ error: 'Module, method, and params are required' });
    }

    const state = context.getState();
    const [account, newAccountPool] = getNextAccount(state.accountPool);

    const call: TransactionCall = { module, method, params };

    const transaction: Transaction = {
        id: `tx-${Date.now()}`,
        account,
        call,
        nonce: 0, // This will be set properly during processing
        status: 'pending',
    };

    const newQueue = enqueueTransaction(state.transactionQueue, transaction);

    const newState: ServerState = {
        transactionQueue: newQueue,
        accountPool: newAccountPool,
        apiState: state.apiState,
        nonceMap: state.nonceMap,
    };

    context.setState(newState);

    // Immediately trigger transaction processing
    processTransactionsAsync(context);

    console.log(`Selected account: ${account.address}`);
    console.log(`Current queue length: ${getQueueLength(state.transactionQueue)}`);
    console.log(`New queue length: ${getQueueLength(newQueue)}`);
    console.log(`Added transaction with ID: ${transaction.id}`);

    return res.status(200).json({ message: 'Transaction added to queue', transactionId: transaction.id });
};

// Modify processTransactionsAsync to continue processing while there are transactions
const processTransactionsAsync = async (context: ServerContext) => {
    const state = context.getState();
    if (!state.apiState.api) {
        console.error('API not initialized');
        return;
    }

    while (getQueueLength(state.transactionQueue) > 0) {
        try {
            const [newQueue, newAccountPool, newNonceMap] = await processTransactions(
                state.apiState.api,
                state.transactionQueue,
                state.accountPool,
                state.nonceMap
            );

            context.setState({
                ...state,
                transactionQueue: newQueue,
                accountPool: newAccountPool,
                nonceMap: newNonceMap,
            });
        } catch (error) {
            console.error('Error processing transactions:', error);
            break;
        }
    }
};

const initializeNonceMap = async (api: ApiPromise, accountPool: AccountPool): Promise<Map<string, number>> => {
    const nonceMap = new Map<string, number>();
    for (const account of accountPool.accounts) {
        const nonce = await api.rpc.system.accountNextIndex(account.address);
        nonceMap.set(account.address, nonce.toNumber());
    }
    return nonceMap;
};

export const createServer = async (initialState: Omit<ServerState, 'nonceMap'>) => {
    const app = express();
    app.use(express.json());

    if (!initialState.apiState.api) {
        throw new Error('API not initialized');
    }

    const nonceMap = await initializeNonceMap(initialState.apiState.api, initialState.accountPool);
    let serverState: ServerState = { ...initialState, nonceMap };

    const context: ServerContext = {
        getState: () => serverState,
        setState: (newState: ServerState) => {
            serverState = newState;
        },
    };

    app.post('/transaction', createTransactionHandler(context));

    return app;
};
