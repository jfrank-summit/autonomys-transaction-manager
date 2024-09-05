import { TransactionQueue, Transaction } from './types';

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

export const updateTransaction = (
    queue: TransactionQueue,
    transactionId: string,
    newStatus: Transaction['status'],
    blockHash?: string,
    txHash?: string
): TransactionQueue => ({
    queue: queue.queue.map(tx => (tx.id === transactionId ? { ...tx, status: newStatus, blockHash, txHash } : tx)),
});
