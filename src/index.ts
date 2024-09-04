import { loadAccountsFromFile } from './accountManager';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    const privateKeysPath = process.env.PRIVATE_KEYS_PATH;
    if (!privateKeysPath) {
        throw new Error('PRIVATE_KEYS_PATH is not set in the environment variables');
    }

    await loadAccountsFromFile(privateKeysPath);
    // More logic will be added here as we progress
    console.log('Accounts loaded successfully');
}

main().catch(console.error);
