import { ApiPromise, WsProvider } from '@polkadot/api';

let api: ApiPromise | null = null;

export const initializeApi = async (nodeUrl: string): Promise<ApiPromise> => {
    if (api) {
        return api;
    }

    const provider = new WsProvider(nodeUrl);
    api = await ApiPromise.create({ provider });

    console.log(`Connected to node: ${(await api.rpc.system.chain()).toString()}`);

    return api;
};

export const getApi = (): ApiPromise => {
    if (!api) {
        throw new Error('API not initialized. Call initializeApi first.');
    }
    return api;
};

export const disconnectApi = async (): Promise<void> => {
    if (api) {
        await api.disconnect();
        api = null;
        console.log('Disconnected from the node');
    }
};
