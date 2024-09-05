import { readFileSync } from 'fs';
import { Keyring } from '@polkadot/keyring';
import { KeyringPair } from '@polkadot/keyring/types';
import { AccountPool } from './types';

const loadAccounts = (privateKeysPath: string): KeyringPair[] => {
    const privateKeys = readFileSync(privateKeysPath, 'utf-8')
        .split('\n')
        .map(key => key.trim())
        .filter(key => key.length > 0);

    const keyring = new Keyring({ type: 'sr25519' });
    return privateKeys.map(key => keyring.addFromUri(key));
};

export const getNextAccount = (pool: AccountPool): [KeyringPair, AccountPool] => {
    if (pool.accounts.length === 0) {
        throw new Error('No accounts available in the pool');
    }
    const account = pool.accounts[pool.currentIndex];
    const newIndex = (pool.currentIndex + 1) % pool.accounts.length;
    return [account, { ...pool, currentIndex: newIndex }];
};

export const removeAccount = (pool: AccountPool, address: string): AccountPool => {
    const newAccounts = pool.accounts.filter(account => account.address !== address);
    return {
        accounts: newAccounts,
        currentIndex: pool.currentIndex >= newAccounts.length ? 0 : pool.currentIndex,
    };
};

export const getAccountCount = (pool: AccountPool): number => pool.accounts.length;

export const createAccountPool = (privateKeysPath: string): AccountPool => {
    return {
        accounts: loadAccounts(privateKeysPath),
        currentIndex: 0,
    };
};
