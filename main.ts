import { type BlockchainDataState, CBRA, Transaction } from "./cbra";

type Token = "ETH" | "USDC";

const bds: BlockchainDataState<Token>[] = [
    {
        "id": 0,
        "blockchain": "ethereum",
        "dataState": "ETH",
    },
    {
        "id": 1,
        "blockchain": "ethereum",
        "dataState": "USDC",
    },
    {
        "id": 2,
        "blockchain": "polygon",
        "dataState": "USDC",
    },
];

const conversionRates = {
    "USDC": {
        "ETH": 0.00027,
        "USDC": 1,
    },
    "ETH": {
        "ETH": 1,
        "USDC": 3698.66,
    }
};

const transactions: Transaction<Token>[] = [
    {
        "id": 0,
        "edge": [bds[0], bds[1]],
    },
    {
        "id": 1,
        "edge": [bds[1], bds[2]],
    },
    {
        "id": 2,
        "edge": [bds[1], bds[2]],
    }
]

const cbra = new CBRA<Token, number>(
    bds,
    transactions,
    (currentValue, transaction) => {
        let newVal = currentValue * conversionRates[transaction.edge[0].dataState][transaction.edge[1].dataState];
        if (transaction.id === 2) {
            newVal *= 2;
        }
        return newVal;
    },
    (newValue, currentValue) => newValue > currentValue,
    -Infinity,
).computeRoute(bds[0], bds[2], 1);

(async () => {
    for await (const edge of cbra) {
        console.log(edge);
    }
})();