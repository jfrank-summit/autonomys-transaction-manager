import { parseArgs } from 'node:util';

interface Config {
    privateKeysPath: string;
    rateLimit: number;
    retryDelay: number;
    nodeUrl: string;
}

const parseConfig = (): Config => {
    const { values } = parseArgs({
        options: {
            privateKeysPath: { type: 'string', short: 'p', long: 'private-keys' },
            rateLimit: { type: 'string', short: 'r', long: 'rate-limit' },
            retryDelay: { type: 'string', short: 'd', long: 'retry-delay' },
            nodeUrl: { type: 'string', short: 'n', long: 'node-url' },
        },
    });

    return {
        privateKeysPath: (values.privateKeysPath as string) || '',
        rateLimit: parseInt((values.rateLimit as string) || '100', 10),
        retryDelay: parseInt((values.retryDelay as string) || '5', 10),
        nodeUrl: (values.nodeUrl as string) || 'ws://127.0.0.1:9944',
    };
};

export const getConfig = (): Config => {
    const config = parseConfig();

    if (!config.privateKeysPath) {
        throw new Error('Private keys file path is required');
    }

    return config;
};
