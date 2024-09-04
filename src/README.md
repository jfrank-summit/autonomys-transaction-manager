# Autonomys Transaction Manager

This is a transaction manager service for the Autonomys Network. It provides a simple API to queue and process transactions efficiently, managing nonces and retrying failed transactions.

## Setup

### Prerequisites

-   Node.js (version 14 or higher)
-   Yarn package manager

### Installation

1. Clone the repository:

    ```bash
    git clone <repository-url>
    cd autonomys-transaction-manager
    ```

2. Install dependencies:

    ```bash
    yarn install
    ```

3. Prepare a file with private keys (one per line) for the accounts you want to use. Save this file in a known location.

## Configuration

The service requires some configuration to run. You can specify the following parameters:

-   `privateKeysPath`: Path to the file containing private keys.
-   `rateLimit`: Rate limit for processing transactions (default: 100).
-   `retryDelay`: Delay in seconds before retrying a failed transaction (default: 5).
-   `nodeUrl`: WebSocket URL of the Substrate node (default: `ws://127.0.0.1:9944`).

### Example Command

To start the service, run the following command, replacing the placeholders with your actual values:

```bash
yarn serve <privateKeysPath> --rate-limit <rateLimit> --retry-delay <retryDelay> --node-url <nodeUrl>
```

For example:

```bash
yarn serve /path/to/private-keys.txt --rate-limit 100 --retry-delay 5 --node-url ws://127.0.0.1:9944
```

## Usage

### Posting Transactions

Once the service is running, you can post transactions to the API. The service exposes an endpoint to add transactions:

**Endpoint:** `POST /transaction`

**Request Body:**

```json
{
    "module": "system",
    "method": "remark",
    "params": ["Your remark here"]
}
```

### Example Using `curl`

You can use `curl` to post a transaction:

```bash
curl -X POST http://localhost:3000/transaction -H "Content-Type: application/json" -d '{
    "module": "system",
    "method": "remark",
    "params": ["Hello, Substrate!"]
}'
```

### Example Using Axios

You can also use Axios in a JavaScript/TypeScript application to post transactions:

```javascript
import axios from 'axios';

const addRemark = async remark => {
    try {
        const response = await axios.post('http://localhost:3000/transaction', {
            module: 'system',
            method: 'remark',
            params: [remark],
        });
        console.log('Transaction ID:', response.data.transactionId);
    } catch (error) {
        console.error('Error posting transaction:', error);
    }
};

addRemark('Hello, Substrate!');
```

## Stopping the Service

To stop the service, you can use `Ctrl + C` in the terminal where the service is running. The service will gracefully shut down and disconnect from the API.
