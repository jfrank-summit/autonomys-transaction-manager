import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { TransactionQueue, Transaction, NonceMap, SetState, TransactionResult } from './types';
import { getQueueLength, updateTransaction } from './transactionQueue';

const updateNonceMap = (nonceMap: NonceMap, address: string, nonce: number): NonceMap => {
    return new Map(nonceMap).set(address, Math.max(nonceMap.get(address) || 0, nonce));
};

const createExtrinsic = (api: ApiPromise, call: Transaction['call']): SubmittableExtrinsic<'promise'> => {
    const { module, method, params } = call;
    return api.tx[module][method](...params);
};

const signAndSendExtrinsic = async (
    api: ApiPromise,
    extrinsic: SubmittableExtrinsic<'promise'>,
    account: KeyringPair,
    nonce: number,
    transactionId: string,
    setTransactionStatus: (id: string, status: Transaction['status']) => void
): Promise<TransactionResult> => {
    return new Promise((resolve, reject) => {
        console.log(`Signing and sending transaction ${transactionId} with nonce ${nonce}`);
        setTransactionStatus(transactionId, 'submitted');
        extrinsic
            .signAndSend(account, { nonce }, ({ status, events, txHash }) => {
                console.log(`Transaction ${transactionId} status: ${status.type}`);
                if (status.isInBlock) {
                    const blockHash = status.asInBlock.toString();
                    console.log(`Transaction ${transactionId} included in block ${blockHash}`);
                    let transactionSucceeded = true;
                    events.forEach(({ event }) => {
                        if (api.events.system.ExtrinsicFailed.is(event)) {
                            console.error(`Transaction ${transactionId} failed`);
                            transactionSucceeded = false;
                        }
                    });
                    if (transactionSucceeded) {
                        const status = 'completed';
                        setTransactionStatus(transactionId, status);
                        resolve({ blockHash, txHash: txHash.toHex(), status });
                    } else {
                        setTransactionStatus(transactionId, 'failed');
                        reject(new Error('Transaction failed'));
                    }
                }
            })
            .catch(error => {
                console.error(`Error submitting transaction ${transactionId}: ${error}`);
                setTransactionStatus(transactionId, 'failed');
                reject(error);
            });
    });
};

const processTransaction = async (
    api: ApiPromise,
    transaction: Transaction & { nonce: number },
    nonceMap: NonceMap,
    setNonceMap: (newNonceMap: NonceMap) => void,
    setTransactionStatus: (id: string, status: Transaction['status']) => void
): Promise<TransactionResult> => {
    const { account, call, id, nonce } = transaction;
    const address = account.address;

    console.log(`[${id}] Starting to process transaction for account ${address}`);
    console.log(`[${id}] Using nonce ${nonce} for account ${address}`);

    const submittableExtrinsic = createExtrinsic(api, call);

    try {
        const newNonce = nonce + 1;
        const newNonceMap = updateNonceMap(nonceMap, address, newNonce);
        setNonceMap(newNonceMap);
        console.log(`[${id}] Updated nonce for account ${address} to ${newNonce}`);

        const { blockHash, txHash } = await signAndSendExtrinsic(
            api,
            submittableExtrinsic,
            account,
            nonce,
            id,
            setTransactionStatus
        );

        console.log(`[${id}] Transaction completed with block hash ${blockHash}`);
        return { blockHash, txHash, status: 'completed' };
    } catch (error: any) {
        console.error(`[${id}] Transaction failed for account ${address}: ${error}`);
        if (error.message.includes('1014: Priority is too low')) {
            console.log(`[${id}] Retrying with incremented nonce`);
            return processTransaction(
                api,
                { ...transaction, nonce: nonce + 1 },
                nonceMap,
                setNonceMap,
                setTransactionStatus
            );
        }
        return { blockHash: '', txHash: '', status: 'failed' };
    }
};

export const processTransactions = async (
    api: ApiPromise,
    queue: TransactionQueue,
    nonceMap: NonceMap,
    setServerState: SetState
): Promise<TransactionQueue> => {
    const { setNonceMap, setTransactionStatus, setTransactionQueue } = setServerState;

    const processTransactionWithDeps = (tx: Transaction) =>
        processTransaction(
            api,
            { ...tx, nonce: nonceMap.get(tx.account.address) || 0 },
            nonceMap,
            setNonceMap,
            setTransactionStatus
        );

    const transactionsToProcess = queue.queue.filter(tx => tx.status === 'pending');

    const processResults = await Promise.all(transactionsToProcess.map(processTransactionWithDeps));

    const updatedQueue = processResults.reduce((acc, { blockHash, status, txHash }, index) => {
        const tx = transactionsToProcess[index];
        return updateTransaction(acc, tx.id, status, blockHash, txHash);
    }, queue);

    setTransactionQueue(updatedQueue);

    console.log(`Processed ${transactionsToProcess.length} transactions`);
    console.log(`Updated queue length: ${getQueueLength(updatedQueue)}`);

    return updatedQueue;
};
