import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { TransactionQueue, Transaction, dequeueTransaction, updateTransactionStatus } from './transactionQueue';
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
    transactionId: string
): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`Signing and sending transaction ${transactionId} with nonce ${nonce}`);
        extrinsic
            .signAndSend(account, { nonce }, ({ status, events }) => {
                console.log(`Transaction ${transactionId} status: ${status.type}`);
                if (status.isInBlock) {
                    console.log(`Transaction ${transactionId} included in block ${status.asInBlock}`);
                } else if (status.isFinalized) {
                    console.log(`Transaction ${transactionId} finalized in block ${status.asFinalized}`);
                    events.forEach(({ event }) => {
                        if (api.events.system.ExtrinsicFailed.is(event)) {
                            console.error(`Transaction ${transactionId} failed`);
                            reject(new Error('Extrinsic failed'));
                        } else if (api.events.system.ExtrinsicSuccess.is(event)) {
                            console.log(`Transaction ${transactionId} succeeded`);
                            resolve(status.asFinalized.toString());
                        }
                    });
                }
            })
            .catch(error => {
                console.error(`Error submitting transaction ${transactionId}: ${error}`);
                reject(error);
            });
    });
};

const processTransaction = async (
    api: ApiPromise,
    transaction: Transaction,
    nonceMap: NonceMap
): Promise<[string, NonceMap, Transaction['status']]> => {
    const { account, call, id } = transaction;
    const address = account.address;

    let nonce = Math.max(nonceMap.get(address) || 0, await getNonce(api, address));
    const submittableExtrinsic = createExtrinsic(api, call);

    console.log(`Processing transaction ${id} for account ${address}`);
    try {
        const blockHash = await signAndSendExtrinsic(api, submittableExtrinsic, account, nonce, id);
        const newNonceMap = updateNonceMap(nonceMap, address, nonce + 1);
        return [blockHash, newNonceMap, 'completed'];
    } catch (error: any) {
        if (error.message.includes('Invalid Transaction: Inability to pay some fees')) {
            console.error(`Insufficient balance for account ${address} in transaction ${id}: ${error}`);
            return ['', nonceMap, 'failed'];
        }
        console.error(`Transaction ${id} failed for account ${address}: ${error}`);
        const newNonceMap = updateNonceMap(nonceMap, address, nonce + 1);
        return ['', newNonceMap, 'failed'];
    }
};

const retryTransaction = async (
    api: ApiPromise,
    transaction: Transaction,
    nonceMap: NonceMap,
    retries: number = 3
): Promise<[string, NonceMap, Transaction['status']]> => {
    for (let i = 0; i < retries; i++) {
        try {
            const [blockHash, newNonceMap, status] = await processTransaction(api, transaction, nonceMap);
            return [blockHash, newNonceMap, status];
        } catch (error) {
            console.log(`Retry ${i + 1} for transaction ${transaction.id} failed`);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    throw new Error('Max retries reached');
};

export const processTransactions = async (
    api: ApiPromise,
    queue: TransactionQueue,
    accountPool: AccountPool,
    nonceMap: NonceMap
): Promise<[TransactionQueue, AccountPool, NonceMap]> => {
    const [transaction, newQueue] = dequeueTransaction(queue);
    if (!transaction) {
        console.log('No transactions in queue');
        return [queue, accountPool, nonceMap];
    }

    console.log(`Starting to process transaction ${transaction.id}`);
    let updatedQueue = updateTransactionStatus(newQueue, transaction.id, 'processing');

    try {
        const [blockHash, updatedNonceMap, status] = await retryTransaction(api, transaction, nonceMap);
        console.log(`Transaction ${transaction.id} processed with status: ${status}`);
        updatedQueue = updateTransactionStatus(updatedQueue, transaction.id, status);

        if (status === 'completed') {
            console.log(`Transaction ${transaction.id} included in block ${blockHash}`);
        }

        return [updatedQueue, accountPool, updatedNonceMap];
    } catch (error: any) {
        console.error(`Failed to process transaction ${transaction.id}: ${error}`);
        updatedQueue = updateTransactionStatus(updatedQueue, transaction.id, 'failed');
        const updatedAccountPool = removeAccount(accountPool, transaction.account.address);
        return [updatedQueue, updatedAccountPool, nonceMap];
    }
};
