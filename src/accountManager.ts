import fs from 'fs/promises';
import { Account } from './types';
import { updateState, getState } from './store';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

export const loadAccountsFromFile = async (filePath: string): Promise<void> => {
    try {
        await cryptoWaitReady();
        const keyring = new Keyring({ type: 'sr25519' });

        const data = await fs.readFile(filePath, 'utf8');
        const privateKeys: string[] = JSON.parse(data);

        const accounts: Account[] = privateKeys.map(privateKey => {
            const keyringPair = keyring.addFromUri(privateKey);
            return {
                address: keyringPair.address,
                nonce: 0,
                keyringPair,
            };
        });

        updateState(draft => {
            draft.accounts = accounts;
        });
    } catch (error) {
        console.error('Error loading accounts:', error);
    }
};

export const addAccount = (privateKey: string): void => {
    const keyring = new Keyring({ type: 'sr25519' });
    const keyringPair = keyring.addFromUri(privateKey);
    const account: Account = {
        address: keyringPair.address,
        nonce: 0,
        keyringPair,
    };
    updateState(draft => {
        draft.accounts.push(account);
    });
};

export const removeAccount = (address: string): void => {
    updateState(draft => {
        draft.accounts = draft.accounts.filter(acc => acc.address !== address);
    });
};

export const getAvailableAccount = (): Account | undefined => {
    const state = getState();
    return state.accounts.find(
        account => !state.transactionQueue.pending.some(tx => tx.submittedBy.address === account.address)
    );
};
