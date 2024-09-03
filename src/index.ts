import { getConfig } from './config';
import { createAccountPool } from './accountPool';
import { createTransactionQueue } from './transactionQueue';
import { createServer, ServerState } from './server';
import { initializeApi, disconnectApi, ApiState } from './networkApi';

const main = async () => {
    try {
        const config = getConfig();
        console.log('Configuration:', config);

        const apiState: ApiState = await initializeApi(config.nodeUrl);

        const initialState: ServerState = {
            transactionQueue: createTransactionQueue(),
            accountPool: createAccountPool(config.privateKeysPath),
            apiState,
        };

        const app = createServer(initialState);

        const port = 3000;
        app.listen(port, () => {
            console.log(`Server running on http://localhost:${port}`);
        });

        // Keep the process running
        process.on('SIGINT', async () => {
            console.log('Shutting down...');
            await disconnectApi(apiState);
            process.exit(0);
        });
    } catch (error) {
        console.error('Error:', (error as Error).message);
        process.exit(1);
    }
};

main();
