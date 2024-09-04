import axios from 'axios';

const addRemark = async (remark: string): Promise<string> => {
    try {
        console.log(`Sending remark: ${remark}`); // Add this line
        const response = await axios.post('http://localhost:3000/transaction', {
            module: 'system',
            method: 'remark',
            params: [remark],
        });
        console.log(`Response for ${remark}:`, response.data); // Add this line
        return response.data.transactionId;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error:', error.response?.data || error.message);
        } else {
            console.error('Error:', error);
        }
        throw error;
    }
};

const addMultipleRemarks = async (count: number) => {
    const startTime = Date.now();
    const transactionIds: string[] = [];

    for (let i = 0; i < count; i++) {
        try {
            const remark = `Test remark ${i + 1} (Run: ${Date.now()})`; // Modified this line
            const transactionId = await addRemark(remark);
            transactionIds.push(transactionId);
            console.log(`Added transaction ${i + 1}/${count} with ID: ${transactionId} and remark: ${remark}`);
        } catch (error) {
            console.error(`Failed to add transaction ${i + 1}/${count}`);
        }
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`\nSubmitted ${transactionIds.length} transactions in ${duration} seconds`);
    console.log(`Average time per transaction: ${duration / count} seconds`);
    console.log(`Transactions per second: ${count / duration}`);
};

const transactionCount = parseInt(process.argv[2], 10) || 10;
addMultipleRemarks(transactionCount);
