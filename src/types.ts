import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';

export interface Account {
    address: string;
    nonce: number;
    keyringPair: KeyringPair;
}

export enum TransactionStatus {
    Pending = 'PENDING',
    Submitted = 'SUBMITTED',
    Confirmed = 'CONFIRMED',
    Failed = 'FAILED',
}

export interface Transaction {
    id: string;
    submittedBy: Account;
    module: string;
    method: string;
    params: any[];
    nonce: number;
    status: TransactionStatus;
    retryCount: number;
}
export interface TransactionQueue {
    pending: Transaction[];
    processing: Transaction[];
}

export interface State {
    accounts: Account[];
    transactionQueue: TransactionQueue;
    api: ApiPromise | null;
}
