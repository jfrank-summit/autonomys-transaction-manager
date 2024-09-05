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

// Add this new handler
const createQueueViewHandler = (context: ServerContext) => (req: express.Request, res: express.Response) => {
    const state = context.getState();
    const queueLength = getQueueLength(state.transactionQueue);
    const queueItems = state.transactionQueue.queue.map(tx => ({
        id: tx.id,
        account: tx.account.address,
        call: tx.call,
        status: tx.status,
    }));

    return res.status(200).json({
        queueLength,
        queueItems,
    });
};

// Modify processTransactionsAsync to continue processing while there are transactions
const processTransactionsAsync = async (context: ServerContext) => {
    const state = context.getState();
    if (!state.apiState.api) {
        console.error('API not initialized');
        return;
    }

    const updateNonceMap = (newNonceMap: Map<string, number>) => {
        console.log('Updating nonce map in server state');
        console.log('Old nonce map:', Object.fromEntries(state.nonceMap));
        console.log('New nonce map:', Object.fromEntries(newNonceMap));
        context.setState({
            ...context.getState(),
            nonceMap: newNonceMap,
        });
        console.log('Nonce map updated in server state');
    };

    const setTransactionStatus = (id: string, status: Transaction['status']) => {
        const currentState = context.getState();
        const currentQueue = currentState.transactionQueue;
        const updatedQueue = {
            queue: currentQueue.queue.map(tx => (tx.id === id ? { ...tx, status } : tx)),
        };
        context.setState({
            ...currentState,
            transactionQueue: updatedQueue,
        });
        console.log(`Transaction ${id} status updated to ${status} in server state`);
    };

    console.log('Starting transaction processing');
    console.log('Initial queue length:', getQueueLength(state.transactionQueue));
    console.log('Initial nonce map:', Object.fromEntries(state.nonceMap));

    try {
        const [newQueue, newAccountPool, newNonceMap] = await processTransactions(
            state.apiState.api,
            state.transactionQueue,
            state.accountPool,
            state.nonceMap,
            updateNonceMap,
            setTransactionStatus
        );

        console.log('Transaction processing completed');
        console.log('Final queue length:', getQueueLength(newQueue));
        console.log('Final nonce map:', Object.fromEntries(newNonceMap));

        // Update the server state with the new queue, account pool, and nonce map
        context.setState({
            ...state,
            transactionQueue: newQueue,
            accountPool: newAccountPool,
            nonceMap: newNonceMap,
        });

        // If there are still transactions in the queue, process them again
        if (getQueueLength(newQueue) > 0) {
            setTimeout(() => processTransactionsAsync(context), 1000); // Wait 1 second before processing again
        }
    } catch (error) {
        console.error('Error processing transactions:', error);
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
    app.get('/queue', createQueueViewHandler(context));

    return app;
};
