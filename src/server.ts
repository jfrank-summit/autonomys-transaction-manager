import express from 'express';
import bodyParser from 'body-parser';
import { addTransaction } from './transactionManager';

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

app.post('/transaction', async (req, res) => {
    const { module, method, params } = req.body;
    if (!module || !method || !params) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    await addTransaction(module, method, params);
    res.status(202).json({ message: 'Transaction added to queue' });
});

export const startServer = () => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
};
