import axios from 'axios';
import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

const postTransaction = async (module: string, method: string, params: any[]) => {
    try {
        const response = await axios.post(`${SERVER_URL}/transaction`, { module, method, params });
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error };
    }
};

const logTransactionResult = (result: { success: boolean; data?: any; error?: any }) => {
    if (result.success) {
        console.log('Transaction posted:', result.data);
    } else {
        console.error('Error posting transaction:', result.error);
    }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createRemark = (index: number) => [`Remark ${index + 1}`];

const addRemarks = async (count: number) => {
    const results = await Promise.all(
        Array.from({ length: count }, (_, i) => i).map(async index => {
            const result = await postTransaction('system', 'remark', createRemark(index));
            await delay(100); // Add a small delay between transactions
            return result;
        })
    );
    return results;
};

const parseArguments = async () =>
    yargs(hideBin(process.argv))
        .command('add-remarks <count>', 'Add a specified number of remarks', yargs => {
            return yargs.positional('count', {
                describe: 'Number of remarks to add',
                type: 'number',
            });
        })
        .demandCommand(1)
        .help().argv;

const main = async () => {
    const argv = await parseArguments();

    if (argv._[0] === 'add-remarks') {
        const count = argv.count as number;
        console.log(`Adding ${count} remarks...`);
        const results = await addRemarks(count);
        results.forEach(logTransactionResult);
        console.log('All remarks added.');
    }
};

main().catch(console.error);
