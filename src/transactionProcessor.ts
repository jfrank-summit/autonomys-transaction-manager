import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { TransactionQueue, Transaction, getQueueLength, updateTransactionStatus } from './transactionQueue';
import { AccountPool, removeAccount } from './accountPool';

type NonceMap = Map<string, number>;

const getNonce = async (api: ApiPromise, address: string): Promise<number> => {
    const nonce = await api.rpc.system.accountNextIndex(address);
    return nonce.toNumber();
};

const updateNonceMap = (nonceMap: NonceMap, address: string, nonce: number): NonceMap => {
    const newMap = new Map(nonceMap);
    newMap.set(address, Math.max(newMap.get(address) || 0, nonce));
    return newMap;
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
): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`Signing and sending transaction ${transactionId} with nonce ${nonce}`);
        setTransactionStatus(transactionId, 'submitted');
        extrinsic
            .signAndSend(account, { nonce }, ({ status, events }) => {
                console.log(`Transaction ${transactionId} status: ${status.type}`);
                if (status.isInBlock) {
                    console.log(`Transaction ${transactionId} included in block ${status.asInBlock}`);
                    let transactionSucceeded = true;
                    events.forEach(({ event }) => {
                        if (api.events.system.ExtrinsicFailed.is(event)) {
                            console.error(`Transaction ${transactionId} failed`);
                            transactionSucceeded = false;
                        }
                    });
                    if (transactionSucceeded) {
                        setTransactionStatus(transactionId, 'completed');
                        resolve(status.asInBlock.toString());
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
): Promise<[string, Transaction['status'], number]> => {
    const { account, call, id, nonce } = transaction;
    const address = account.address;

    console.log(`[${id}] Starting to process transaction for account ${address}`);
    console.log(`[${id}] Using nonce ${nonce} for account ${address}`);

    const submittableExtrinsic = createExtrinsic(api, call);

    try {
        // console.log(`[${id}] Submitting transaction`);
        // setTransactionStatus(id, 'submitted');
        const newNonce = nonce + 1;
        const newNonceMap = updateNonceMap(nonceMap, address, newNonce);
        setNonceMap(newNonceMap);
        console.log(`[${id}] Updated nonce for account ${address} to ${newNonce}`);
        const blockHash = await signAndSendExtrinsic(
            api,
            submittableExtrinsic,
            account,
            nonce,
            id,
            setTransactionStatus
        );

        console.log(`[${id}] Transaction completed with block hash ${blockHash}`);
        return [blockHash, 'completed', newNonce];
    } catch (error: any) {
        console.error(`[${id}] Transaction failed for account ${address}: ${error}`);
        if (error.message.includes('1014: Priority is too low')) {
            // If the error is due to low priority, we should increment the nonce and retry
            console.log(`[${id}] Retrying with incremented nonce`);
            return processTransaction(
                api,
                { ...transaction, nonce: nonce + 1 },
                nonceMap,
                setNonceMap,
                setTransactionStatus
            );
        }
        return ['', 'failed', nonce];
    }
};

export const processTransactions = async (
    api: ApiPromise,
    queue: TransactionQueue,
    accountPool: AccountPool,
    nonceMap: NonceMap,
    setNonceMap: (newNonceMap: NonceMap) => void,
    setTransactionStatus: (id: string, status: Transaction['status']) => void
): Promise<[TransactionQueue, AccountPool, NonceMap]> => {
    let currentQueue = queue;
    let currentAccountPool = accountPool;
    let currentNonceMap = new Map(nonceMap);

    const transactionsToProcess = currentQueue.queue.filter(tx => tx.status === 'pending');
    console.log(`Transactions to process: ${JSON.stringify(transactionsToProcess)}`);

    for (const transaction of transactionsToProcess) {
        console.log(`Processing transaction ${transaction.id} with status ${transaction.status}`);
        console.log(`Current queue length: ${getQueueLength(currentQueue)}`);

        try {
            const address = transaction.account.address;
            let nonce = currentNonceMap.get(address) || (await getNonce(api, address));
            console.log(`[${transaction.id}] Using nonce ${nonce} for account ${address}`);

            const [blockHash, status, newNonce] = await processTransaction(
                api,
                { ...transaction, nonce },
                currentNonceMap,
                setNonceMap,
                setTransactionStatus
            );
            console.log(`Transaction ${transaction.id} processed with status: ${status}`);

            if (status === 'failed') {
                console.log(`Transaction ${transaction.id} failed`);
                currentAccountPool = removeAccount(currentAccountPool, address);
            }

            currentNonceMap = updateNonceMap(currentNonceMap, address, newNonce);

            // Update the transaction status in the current queue
            currentQueue = updateTransactionStatus(currentQueue, transaction.id, status);
        } catch (error: any) {
            console.error(`Failed to process transaction ${transaction.id}: ${error}`);
            setTransactionStatus(transaction.id, 'failed');
            currentAccountPool = removeAccount(currentAccountPool, transaction.account.address);
            // Update the transaction status in the current queue
            currentQueue = updateTransactionStatus(currentQueue, transaction.id, 'failed');
        }
    }

    // Remove completed and failed transactions from the queue
    currentQueue = {
        queue: currentQueue.queue.filter(tx => tx.status === 'pending'),
    };

    console.log(`Processed ${transactionsToProcess.length} transactions`);
    console.log(`Remaining queue length: ${getQueueLength(currentQueue)}`);

    return [currentQueue, currentAccountPool, currentNonceMap];
};
