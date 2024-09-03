import { getConfig } from './config';

const main = () => {
    try {
        const config = getConfig();
        console.log('Configuration:', config);
    } catch (error) {
        console.error('Error:', (error as Error).message);
        process.exit(1);
    }
};

main();
