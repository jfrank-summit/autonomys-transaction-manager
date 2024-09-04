import axios from 'axios';

const addRemark = async (remark: string) => {
    try {
        const response = await axios.post('http://localhost:3000/transaction', {
            module: 'system',
            method: 'remark',
            params: [remark],
        });

        console.log('Response:', response.data);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error:', error.response?.data || error.message);
        } else {
            console.error('Error:', error);
        }
    }
};

const remark = process.argv[2] || 'Hello, Substrate!';
addRemark(remark);
