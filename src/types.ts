import { KeyringPair } from '@polkadot/keyring/types';
import { ApiState } from './networkApi';

export type NonceMap = ReadonlyMap<string, number>;

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
    blockHash?: string;
    txHash?: string;
};

export type TransactionQueue = {
    queue: Transaction[];
};

export type AccountPool = {
    accounts: KeyringPair[];
    currentIndex: number;
};

export type ServerState = {
    transactionQueue: TransactionQueue;
    accountPool: AccountPool;
    apiState: ApiState;
    nonceMap: NonceMap;
};

export type ServerContext = {
    getState: () => ServerState;
    setState: (newState: ServerState) => void;
};

export type SetState = {
    setNonceMap: (newNonceMap: NonceMap) => void;
    setTransactionQueue: (newTransactionQueue: TransactionQueue) => void;
    setTransactionStatus: (id: string, status: Transaction['status']) => void;
};

export type TransactionResult = {
    blockHash: string;
    status: Transaction['status'];
    txHash: string;
};
