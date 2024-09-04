import { updateState, getState } from './store';
import { Transaction, TransactionStatus, Account } from './types';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { SubmittableExtrinsic } from '@polkadot/api/types';

let currentAccountIndex = 0;

const getNextAccount = (): Account | undefined => {
    const state = getState();
    if (state.accounts.length === 0) return undefined;
    const account = state.accounts[currentAccountIndex];
    currentAccountIndex = (currentAccountIndex + 1) % state.accounts.length;
    return account;
};

const createExtrinsic = (api: ApiPromise, tx: Transaction): SubmittableExtrinsic<'promise'> => {
    return api.tx[tx.module][tx.method](...tx.params);
};

const fetchOnChainNonce = async (api: ApiPromise, address: string): Promise<number> => {
    const nonce = await api.rpc.system.accountNextIndex(address);
    console.log(`Fetched on-chain nonce for ${address}: ${nonce}`);
    return nonce.toNumber();
};

const getNextNonce = async (api: ApiPromise, account: Account): Promise<number> => {
    const onChainNonce = await fetchOnChainNonce(api, account.address);
    const pendingNonce = getState().transactionQueue.pending.filter(tx => tx.submittedBy === account.address).length;
    const nextNonce = Math.max(account.nonce, onChainNonce) + pendingNonce;
    console.log(`Calculated next nonce for ${account.address}: ${nextNonce}`);
    return nextNonce;
};

export const addTransaction = async (module: string, method: string, params: any[]): Promise<void> => {
    const state = getState();
    if (!state.api) {
        console.error('API not initialized');
        return;
    }

    const account = getNextAccount();
    if (!account) {
        console.error('No accounts available to submit transaction');
        return;
    }

    const nonce = await getNextNonce(state.api, account);

    updateState(draft => {
        const transaction: Transaction = {
            id: account.address + Date.now().toString(),
            submittedBy: account.address,
            module,
            method,
            params,
            nonce,
            status: TransactionStatus.Pending,
            retryCount: 0,
        };

        draft.transactionQueue.pending.push(transaction);
        console.log(`Added transaction to queue: ${JSON.stringify(transaction)}`);
    });

    // Process the new transaction immediately
    await processNextTransaction();
};

const processTransaction = async (tx: Transaction): Promise<void> => {
    const state = getState();
    if (!state.api) return;

    const account = state.accounts.find(acc => acc.address === tx.submittedBy);
    if (!account) {
        console.error(`Account not found for address: ${tx.submittedBy}`);
        updateTransactionStatus(tx.id, TransactionStatus.Failed);
        return;
    }

    try {
        const extrinsic = createExtrinsic(state.api, tx);
        console.log(`Submitting transaction: ${JSON.stringify(tx)}`);

        await new Promise<void>((resolve, reject) => {
            extrinsic.signAndSend(
                account.keyringPair,
                { nonce: tx.nonce },
                handleTransactionStatus(tx, resolve, reject)
            );
        });

        updateTransactionStatus(tx.id, TransactionStatus.Submitted);
        updateAccountNonce(tx.submittedBy, tx.nonce + 1);
    } catch (error) {
        console.error(`Failed to submit transaction: ${error}`);
        handleTransactionError(tx, error);
    }
};

const handleTransactionStatus =
    (tx: Transaction, resolve: () => void, reject: (error: Error) => void) =>
    (result: { status: any; events: any; dispatchError: any }) => {
        const { status, events, dispatchError } = result;
        console.log(`Transaction status: ${status.type}`);

        if (dispatchError) {
            handleDispatchError(dispatchError, reject);
            return;
        }

        if (status.isInBlock || status.isFinalized) {
            handleInBlockStatus(tx, status, events, resolve, reject);
        }
    };

const handleDispatchError = (dispatchError: any, reject: (error: Error) => void) => {
    const state = getState();
    if (dispatchError.isModule) {
        const decoded = state.api!.registry.findMetaError(dispatchError.asModule);
        const { docs, name, section } = decoded;
        console.error(`${section}.${name}: ${docs.join(' ')}`);
    } else {
        console.error(dispatchError.toString());
    }
    reject(new Error(`Transaction failed: ${dispatchError.toString()}`));
};

const handleInBlockStatus = (
    tx: Transaction,
    status: any,
    events: any,
    resolve: () => void,
    reject: (error: Error) => void
) => {
    const state = getState();
    events
        .filter(({ event }: { event: any }) => state.api!.events.system.ExtrinsicFailed.is(event))
        .forEach(({ event }: { event: any }) => {
            console.error(`Transaction failed: ${event.data.toString()}`);
            reject(new Error(`Transaction failed: ${event.data.toString()}`));
        });

    if (status.isFinalized) {
        console.log(`Transaction finalized at blockHash ${status.asFinalized}`);
        updateTransactionStatus(tx.id, TransactionStatus.Confirmed);
        resolve();
    }
};

const handleTransactionError = (tx: Transaction, error: any) => {
    if (error instanceof Error && error.message.includes('Priority is too low')) {
        const delay = Math.min(1000 * 2 ** tx.retryCount, 30000);
        console.log(`Transaction priority too low. Waiting ${delay}ms before retry...`);
        setTimeout(() => retryTransaction(tx), delay);
    } else {
        updateTransactionStatus(tx.id, TransactionStatus.Failed);
    }
};

const retryTransaction = (tx: Transaction) => {
    updateState(draft => {
        const transaction = draft.transactionQueue.pending.find(t => t.id === tx.id);
        if (transaction) {
            transaction.retryCount++;
            transaction.status = TransactionStatus.Pending;
        }
    });
    processNextTransaction();
};

export const processNextTransaction = async (): Promise<void> => {
    const state = getState();
    if (state.transactionQueue.pending.length === 0) return;

    const nextTx = state.transactionQueue.pending[0];
    await processTransaction(nextTx);
};

const updateTransactionStatus = (id: string, status: TransactionStatus): void => {
    updateState(draft => {
        const pendingIndex = draft.transactionQueue.pending.findIndex(t => t.id === id);
        if (pendingIndex !== -1) {
            const tx = draft.transactionQueue.pending[pendingIndex];
            tx.status = status;
            if (status === TransactionStatus.Submitted) {
                draft.transactionQueue.processing.push(tx);
                draft.transactionQueue.pending.splice(pendingIndex, 1);
            } else if (status === TransactionStatus.Failed) {
                draft.transactionQueue.pending.splice(pendingIndex, 1);
            }
        } else {
            const processingIndex = draft.transactionQueue.processing.findIndex(t => t.id === id);
            if (processingIndex !== -1) {
                const tx = draft.transactionQueue.processing[processingIndex];
                tx.status = status;
                if (status === TransactionStatus.Confirmed || status === TransactionStatus.Failed) {
                    draft.transactionQueue.processing.splice(processingIndex, 1);
                }
            }
        }
    });
};

const updateAccountNonce = (address: string, newNonce: number): void => {
    updateState(draft => {
        const account = draft.accounts.find(acc => acc.address === address);
        if (account) {
            account.nonce = Math.max(account.nonce, newNonce);
            console.log(`Updated nonce for ${account.address}: ${account.nonce}`);
        }
    });
};

export const initializeApi = async (nodeUrl: string): Promise<void> => {
    try {
        const provider = new WsProvider(nodeUrl);
        const api = await ApiPromise.create({ provider });
        updateState(draft => {
            draft.api = api;
        });
        console.log('API initialized successfully');
    } catch (error) {
        console.error('Failed to initialize API:', error);
    }
};
