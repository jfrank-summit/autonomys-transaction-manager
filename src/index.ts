import { getConfig } from './config';
import { initializeApi, disconnectApi } from './api';

const main = async () => {
    try {
        const config = getConfig();
        console.log('Configuration:', config);

        const api = await initializeApi(config.nodeUrl);
        console.log('API initialized');

        // Your main logic will go here

        await disconnectApi();
    } catch (error) {
        console.error('Error:', (error as Error).message);
        process.exit(1);
    }
};

main();
