import express from 'express';
import { TransactionQueue, enqueueTransaction, Transaction, getQueueLength } from './transactionQueue';
import { AccountPool, getNextAccount } from './accountPool';
import { ApiState } from './networkApi';

export type ServerState = {
    transactionQueue: TransactionQueue;
    accountPool: AccountPool;
    apiState: ApiState;
};

type ServerContext = {
    getState: () => ServerState;
    setState: (newState: ServerState) => void;
};

const createTransactionHandler = (context: ServerContext) => (req: express.Request, res: express.Response) => {
    const { extrinsic } = req.body;

    if (!extrinsic) {
        console.log('Invalid request: extrinsic is missing');
        return res.status(400).json({ error: 'Extrinsic is required' });
    }

    const state = context.getState();
    const [account, newAccountPool] = getNextAccount(state.accountPool);

    const transaction: Transaction = {
        id: `tx-${Date.now()}`,
        account,
        extrinsic,
        nonce: 0, // TODO: Properly manage nonce
        status: 'pending',
    };

    const newQueue = enqueueTransaction(state.transactionQueue, transaction);

    const newState: ServerState = {
        transactionQueue: newQueue,
        accountPool: newAccountPool,
        apiState: state.apiState, // Include the apiState in the new state
    };

    context.setState(newState);

    console.log(`Selected account: ${account.address}`);
    console.log(`Current queue length: ${getQueueLength(state.transactionQueue)}`);
    console.log(`New queue length: ${getQueueLength(newQueue)}`);
    console.log(`Added transaction with ID: ${transaction.id}`);

    return res.status(200).json({ message: 'Transaction added to queue', transactionId: transaction.id });
};

export const createServer = (initialState: ServerState) => {
    const app = express();
    app.use(express.json());

    let serverState = initialState;

    const context: ServerContext = {
        getState: () => serverState,
        setState: (newState: ServerState) => {
            serverState = newState;
        },
    };

    app.post('/transaction', createTransactionHandler(context));

    return app;
};
