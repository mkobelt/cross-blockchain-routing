/// <reference path="../typings/array_map_fix.d.ts" />

import { Arc, CBRA } from "./cbra"

const repetitions = 300
const tokenCount = 5
const dexCount = 2
const swapAmount = 1

evaluate(20, 0.05)

function evaluate(blockchainCount: number, volatility: number) {
    const blockchains = [...Array(blockchainCount).keys()]
    const tokens = [...Array(tokenCount).keys()]
    const dexes = [...Array(dexCount).keys()]
    const bridgesAndDexes = [...dexes, dexes.length]

    type Blockchain = number
    type Token = number
    type BridgeOrDex = number

    type BlockchainToken = {
        "blockchain": Blockchain
        "token": Token
    }

    const bridgeToken = Math.floor(tokenCount / 2)

    const blockchainTokens: BlockchainToken[] = blockchains.flatMap(blockchain => tokens.map(token => ({
        blockchain,
        token,
    })))

    const arcs: Arc<BlockchainToken, BridgeOrDex>[] = blockchainTokens.flatMap(source =>
        blockchainTokens
            .flatMap(destination => {
                const bridgeOrDexes: BridgeOrDex[] = []

                if (source.blockchain === destination.blockchain) {
                    bridgeOrDexes.push(...dexes)
                } else if (Math.abs(source.blockchain - destination.blockchain) === 1 && source.token === bridgeToken && destination.token === bridgeToken) {
                    bridgeOrDexes.push(dexCount)
                }

                return bridgeOrDexes.map(bridgeOrDex => ({
                    "from": source,
                    "to": destination,
                    "details": bridgeOrDex,
                }))
            } )
    )

    const cbraInstance = new CBRA(
        blockchainTokens,
        arcs,
    )

    const initialExchangeRates = blockchains.reduce((obj, fromBlockchain) => {
        obj[fromBlockchain] = blockchains.reduce((obj, toBlockchain) => {
            obj[toBlockchain] = bridgesAndDexes.reduce((obj, bridgeOrDex) => {
                obj[bridgeOrDex] = tokens.reduce((obj, from) => {
                    obj[from] = tokens.reduce((obj, to) => {
                        obj[to] = 1
                        return obj
                    }, {} as Record<Token, number>)
                    return obj
                }, {} as Record<Token, Record<Token, number>>)
                return obj
            }, {} as Record<BridgeOrDex, Record<Token, Record<Token, number>>>)
            return obj
        }, {} as Record<Blockchain, Record<BridgeOrDex, Record<Token, Record<Token, number>>>>) 
        return obj
    }, {} as Record<Blockchain, Record<Blockchain, Record<BridgeOrDex, Record<Token, Record<Token, number>>>>>)

    for (let i = 0; i < repetitions; i++) {
        const exchangeRates = structuredClone(initialExchangeRates)

        const dynamicRoute = cbraInstance.computeRoute(
            blockchainTokens[0],
            blockchainTokens[blockchainTokens.length - 1],
            swapAmount,
            -Infinity,
            ({from, to, details}, currentValue) => currentValue * exchangeRates[from.blockchain][to.blockchain][details][from.token][to.token],
            (newValue, currentValue) => newValue > currentValue,
        )
    
        const staticRoute = cbraInstance.computeRoute(
            blockchainTokens[0],
            blockchainTokens[blockchainTokens.length - 1],
            swapAmount,
            -Infinity,
            ({from, to, details}, currentValue) => currentValue * initialExchangeRates[from.blockchain][to.blockchain][details][from.token][to.token],
            (newValue, currentValue) => newValue > currentValue,
        )
    
        let dynamicOut = swapAmount, staticOut = swapAmount
    
        for (
            let nextDynamic = dynamicRoute.next(), nextStatic = staticRoute.next();
            !nextDynamic.done || !nextStatic.done;
            nextDynamic = dynamicRoute.next(), nextStatic = staticRoute.next()
        ) {
            const dynamicHop = nextDynamic.value
            if (dynamicHop) {
                dynamicOut = dynamicHop.labels[1]
            }
    
            const staticHop = nextStatic.value
            if (staticHop) {
                const arc = staticHop.arc
                const {from, to} = arc
                staticOut *= exchangeRates[from.blockchain][to.blockchain][arc.details][from.token][to.token]
            }
            
            updateExchangeRates()
        }
    
        console.log("Static result:", staticOut)
        console.log("Dynamic result:", dynamicOut)
    
        function updateExchangeRates() {
            for (const fromBlockchain in exchangeRates) {
                const toBlockchains = exchangeRates[fromBlockchain as unknown as Blockchain]
                for (const toBlockchain in toBlockchains) {
                    const bridgeOrDexes = toBlockchains[toBlockchain as unknown as Blockchain]
                    for (const bridgeOrDex in bridgeOrDexes) {
                        const fromTokens = bridgeOrDexes[bridgeOrDex as unknown as BridgeOrDex]
                        for (const fromToken in fromTokens) {
                            const toTokens = fromTokens[fromToken as unknown as Token]
                            for (const toToken in toTokens) {
                                toTokens[toToken as unknown as Token] *= getRandomArbitrary(1 - volatility, 1)
                            }
                        }
                    }
                }
            }
        }
    }
}

function getRandomArbitrary(min: number, max: number) {
    return Math.random() * (max - min) + min;
}
