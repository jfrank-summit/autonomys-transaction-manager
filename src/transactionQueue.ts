import { KeyringPair } from '@polkadot/keyring/types';

export type TransactionCall = {
    module: string;
    method: string;
    params: any[];
};

export type Transaction = {
    id: string;
    account: KeyringPair;
    call: TransactionCall;
    nonce: number;
    status: 'pending' | 'submitted' | 'completed' | 'failed';
};

export type TransactionQueue = {
    queue: Transaction[];
};

export const createTransactionQueue = (): TransactionQueue => ({
    queue: [],
});

export const enqueueTransaction = (queue: TransactionQueue, transaction: Transaction): TransactionQueue => {
    const newQueue = [...queue.queue, transaction];
    return {
        queue: newQueue.sort((a, b) => {
            if (a.account.address === b.account.address) {
                return a.nonce - b.nonce;
            }
            return 0;
        }),
    };
};

export const getQueueLength = (queue: TransactionQueue): number => queue.queue.length;

export const updateTransactionStatus = (
    queue: TransactionQueue,
    transactionId: string,
    newStatus: Transaction['status']
): TransactionQueue => ({
    queue: queue.queue.map(tx => (tx.id === transactionId ? { ...tx, status: newStatus } : tx)),
});
