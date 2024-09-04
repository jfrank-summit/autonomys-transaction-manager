import dotenv from 'dotenv';

dotenv.config();

interface Config {
    privateKeysPath: string;
    rateLimit: number;
    retryDelay: number;
    nodeUrl: string;
}

const getConfig = (): Config => {
    const privateKeysPath = process.env.PRIVATE_KEYS_PATH || '';
    const rateLimit = parseInt(process.env.RATE_LIMIT || '100', 10);
    const retryDelay = parseInt(process.env.RETRY_DELAY || '5', 10);
    const nodeUrl = process.env.NODE_URL || 'ws://127.0.0.1:9944';

    if (!privateKeysPath) {
        throw new Error('Private keys file path is required in the .env file');
    }

    return {
        privateKeysPath,
        rateLimit,
        retryDelay,
        nodeUrl,
    };
};

export { getConfig };
