import { ApiPromise, WsProvider } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';

type ApiState = {
    api: ApiPromise | null;
    isInitialized: boolean;
};

const initializeWasm = async (): Promise<void> => {
    await cryptoWaitReady();
    console.log('WASM initialized');
};

const createApi = async (nodeUrl: string): Promise<ApiPromise> => {
    const provider = new WsProvider(nodeUrl);
    const api = await ApiPromise.create({ provider });
    return api;
};

const connectToNode = async (api: ApiPromise): Promise<string> => {
    const chain = await api.rpc.system.chain();
    return chain.toString();
};

export const initializeApi = async (nodeUrl: string): Promise<ApiState> => {
    await initializeWasm();
    const api = await createApi(nodeUrl);
    const chainName = await connectToNode(api);
    console.log(`Connected to chain: ${chainName}`);
    return { api, isInitialized: true };
};

export const disconnectApi = async (apiState: ApiState): Promise<void> => {
    if (apiState.api && apiState.isInitialized) {
        await apiState.api.disconnect();
        console.log('Disconnected from the node');
    }
};

export type { ApiState };
