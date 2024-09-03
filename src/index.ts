import { getConfig } from './config';
import { initializeApi, disconnectApi } from './networkApi';
import { createAccountPool, getNextAccount, getAccountCount } from './accountPool';
import {
    createTransactionQueue,
    enqueueTransaction,
    dequeueTransaction,
    getQueueLength,
    Transaction,
} from './transactionQueue';

const main = async () => {
    try {
        const config = getConfig();
        console.log('Configuration:', config);

        const api = await initializeApi(config.nodeUrl);
        console.log('API initialized');

        let accountPool = createAccountPool(config.privateKeysPath);
        console.log(`Loaded ${getAccountCount(accountPool)} accounts`);

        let transactionQueue = createTransactionQueue();

        // Example usage of account pool and transaction queue
        for (let i = 0; i < 5; i++) {
            const [account, newPool] = getNextAccount(accountPool);
            accountPool = newPool;

            const transaction: Transaction = {
                id: `tx-${i}`,
                account,
                extrinsic: `extrinsic-${i}`,
                nonce: i,
                status: 'pending',
            };

            transactionQueue = enqueueTransaction(transactionQueue, transaction);
            console.log(`Enqueued transaction ${transaction.id} for account ${account.address}`);
        }

        console.log(`Queue length: ${getQueueLength(transactionQueue)}`);

        // Example of processing the queue
        while (getQueueLength(transactionQueue) > 0) {
            const [transaction, newQueue] = dequeueTransaction(transactionQueue);
            transactionQueue = newQueue;

            if (transaction) {
                console.log(`Processing transaction ${transaction.id} for account ${transaction.account.address}`);
                // Here you would actually process the transaction
            }
        }

        // Your main logic will go here

        await disconnectApi();
    } catch (error) {
        console.error('Error:', (error as Error).message);
        process.exit(1);
    }
};

main();
