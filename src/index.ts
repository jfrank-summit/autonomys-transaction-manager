import { getConfig } from './config';
import { initializeApi, disconnectApi } from './api';
import { createAccountPool, getNextAccount, getAccountCount } from './accountPool';

const main = async () => {
    try {
        const config = getConfig();
        console.log('Configuration:', config);

        const api = await initializeApi(config.nodeUrl);
        console.log('API initialized');

        let accountPool = createAccountPool(config.privateKeysPath);
        console.log(`Loaded ${getAccountCount(accountPool)} accounts`);

        // Example usage of account pool
        for (let i = 0; i < 5; i++) {
            const [account, newPool] = getNextAccount(accountPool);
            accountPool = newPool;
            console.log(`Round ${i + 1}: Selected account ${account.address}`);
        }

        // Your main logic will go here

        await disconnectApi();
    } catch (error) {
        console.error('Error:', (error as Error).message);
        process.exit(1);
    }
};

main();
