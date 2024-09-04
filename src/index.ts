import { loadAccountsFromFile } from './accountManager';
import { addTransaction, processNextTransaction, retryFailedTransactions } from './transactionManager';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    const privateKeysPath = process.env.PRIVATE_KEYS_PATH;
    if (!privateKeysPath) {
        throw new Error('PRIVATE_KEYS_PATH is not set in the environment variables');
    }

    await loadAccountsFromFile(privateKeysPath);
    console.log('Accounts loaded successfully');

    // Example usage
    addTransaction('balances', 'transfer', ['5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', 1000]);

    // Process transactions and retry failed ones periodically
    setInterval(async () => {
        await processNextTransaction();
        retryFailedTransactions();
    }, 1000); // Adjust the interval as needed

    // More logic will be added here as we progress
}

main().catch(console.error);
