/// <reference path="../typings/array_map_fix.d.ts" />

import { CBRA, Arc } from "./cbra"

type SwapBlockchain = {
    "blockchain": "Ethereum" | "Polygon"
    "token": "ETH" | "USDC"
}

const eth_ETH: SwapBlockchain = {
    "blockchain": "Ethereum",
    "token": "ETH",
}
const eth_USDC: SwapBlockchain = {
    "blockchain": "Ethereum",
    "token": "USDC",
}
const plg_USDC: SwapBlockchain = {
    "blockchain": "Polygon",
    "token": "USDC",
}

const blockchains: SwapBlockchain[] = [
    eth_ETH,
    eth_USDC,
    plg_USDC,
]

const conversionRates = {
    "USDC": {
        "ETH": 1 / 3000,
        "USDC": 1,
    },
    "ETH": {
        "ETH": 1,
        "USDC": 3000,
    }
}

const transactions: Arc<SwapBlockchain, undefined>[] = [
    {"from": eth_ETH, "to": eth_USDC, "details": undefined},
    {"from": eth_USDC, "to": plg_USDC, "details": undefined},
    {"from": eth_USDC, "to": plg_USDC, "details": undefined},
]

const swapAmount = 1

const cbra = new CBRA(
    blockchains,
    transactions,
).computeRoute(
    blockchains[0],
    blockchains[2],
    swapAmount,
    -Infinity,
    ({from, to}, currentValue) => currentValue * conversionRates[from.token][to.token],
    (newValue, currentValue) => newValue > currentValue,
);

(async () => {
    for (const edge of cbra) {
        console.log(edge);
    }
})()
