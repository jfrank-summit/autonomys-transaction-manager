import { parseArgs } from 'node:util';

interface Config {
    privateKeysPath: string;
    rateLimit: number;
    retryDelay: number;
}

const parseConfig = (): Config => {
    const { values } = parseArgs({
        options: {
            privateKeysPath: { type: 'string', short: 'p', long: 'private-keys' },
            rateLimit: { type: 'string', short: 'r', long: 'rate-limit' },
            retryDelay: { type: 'string', short: 'd', long: 'retry-delay' },
        },
    });

    return {
        privateKeysPath: (values.privateKeysPath as string) || '',
        rateLimit: parseInt((values.rateLimit as string) || '100', 10),
        retryDelay: parseInt((values.retryDelay as string) || '5', 10),
    };
};

export const getConfig = (): Config => {
    const config = parseConfig();

    if (!config.privateKeysPath) {
        throw new Error('Private keys file path is required');
    }

    return config;
};
