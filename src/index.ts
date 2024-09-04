import { loadAccountsFromFile } from './accountManager';
import { initializeApi } from './transactionManager';
import { startServer } from './server';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    const privateKeysPath = process.env.PRIVATE_KEYS_PATH;
    const nodeUrl = process.env.NODE_URL;
    if (!privateKeysPath || !nodeUrl) {
        throw new Error('PRIVATE_KEYS_PATH or NODE_URL is not set in the environment variables');
    }

    await loadAccountsFromFile(privateKeysPath);
    await initializeApi(nodeUrl);
    startServer();
}

main().catch(console.error);
