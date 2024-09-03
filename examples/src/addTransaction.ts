import axios from 'axios';

const addTransaction = async () => {
    try {
        const response = await axios.post('http://localhost:3000/transaction', {
            extrinsic: 'example_extrinsic_data',
        });

        console.log('Response:', response.data);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error adding transaction:', error.response?.data || error.message);
        } else {
            console.error('Unexpected error:', error);
        }
    }
};

addTransaction();
