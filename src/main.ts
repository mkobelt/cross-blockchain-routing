/// <reference path="../typings/array_map_fix.d.ts" />

import { Cbra, Transaction } from "./cbra"

type Token = "ETH" | "USDC"

type SwapBlockchain = {
    "blockchain": string
    "token": Token
}

const blockchains: SwapBlockchain[] = [
    {
        "blockchain": "ethereum",
        "token": "ETH",
    },
    {
        "blockchain": "ethereum",
        "token": "USDC",
    },
    {
        "blockchain": "polygon",
        "token": "USDC",
    },
]

const conversionRates = {
    "USDC": {
        "ETH": 0.00027,
        "USDC": 1,
    },
    "ETH": {
        "ETH": 1,
        "USDC": 3698.66,
    }
}

const transactions: Transaction<SwapBlockchain>[] = [
    [blockchains[0], blockchains[1]],
    [blockchains[1], blockchains[2]],
    [blockchains[1], blockchains[2]],
]

const swapAmount = 1

const cbra = new Cbra(
    blockchains,
    transactions,
).computeRoute(
    blockchains[0],
    blockchains[2],
    swapAmount,
    -Infinity,
    ([from, to], currentValue) => currentValue * conversionRates[from.token][to.token],
    (newValue, currentValue) => newValue > currentValue,
);

(async () => {
    for await (const edge of cbra) {
        console.log(edge);
    }
})()
