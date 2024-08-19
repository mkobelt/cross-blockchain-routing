import { Arc, CBRA } from "./cbra"
import path from "node:path"
import fs from "node:fs"
import { stringify } from "csv-stringify/sync"

type Parameters = {
    "blockchains": number
    "tokens": number
    "exchanges": number
    "volatility": number
}

type BoxPlot = {
    "median": number
    "minimum": number
    "maximum": number
    "lower": number
    "upper": number
}

const repetitions = 1000
const swapAmount = 100_000

const defaultTokens = 6
const defaultExchanges = 2
const defaultBlockchains = 3
const defaultVolatility = 0.01

const outDir = path.resolve(__dirname, "../csv")

if (!fs.existsSync(outDir)){
    fs.mkdirSync(outDir)
}

run("blockchains", 2, 10, 1)
run("tokens", 2, 10, 1)
run("exchanges", 1, 10, 1)
run("volatility", 0, 0.1, 0.01)

function run<T extends keyof Parameters>(variable: T, from: number, to: number, step: number) {
    const data: (BoxPlot & {"x": number})[] = []

    for (let x = from; x <= to; x += step) {
        const obj = Object.assign({
            x,
        }, evaluate({
            "blockchains": defaultBlockchains,
            "tokens": defaultTokens,
            "exchanges": defaultExchanges,
            "volatility": defaultVolatility,
            [variable]: x,
        }))

        data.push(obj)
    }

    fs.writeFileSync(path.resolve(outDir, `${variable}.csv`), stringify(data, {"header": true}))
}

function evaluate(params: Parameters): BoxPlot {
    const blockchains = [...Array(params.blockchains).keys()]
    const tokens = [...Array(params.tokens).keys()]
    const dexes = [...Array(params.exchanges).keys()]
    const bridgesAndDexes = [...dexes, dexes.length]

    type Blockchain = number
    type Token = number
    type BridgeOrDex = number

    type BlockchainToken = {
        "blockchain": Blockchain
        "token": Token
    }

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
                } else if (
                    destination.blockchain - source.blockchain === 1 && // One-directional bridging
                    source.token === destination.token &&
                    source.token === source.blockchain % params.tokens // Make sure that the exchanges on the destination blockchain can't simply be skipped by directly bridging again
                ) {
                    bridgeOrDexes.push(dexes.length)
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

    const results: number[] = []

    for (let i = 0; i < repetitions; i++) {
        const initialExchangeRates = blockchains.reduce((obj, fromBlockchain) => {
            obj[fromBlockchain] = blockchains.reduce((obj, toBlockchain) => {
                obj[toBlockchain] = bridgesAndDexes.reduce((obj, bridgeOrDex) => {
                    obj[bridgeOrDex] = tokens.reduce((obj, from) => {
                        obj[from] = tokens.reduce((obj, to) => {
                            obj[to] = getRandomArbitrary(1 - params.volatility, 1)
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

        results.push(dynamicOut / staticOut)

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
                                toTokens[toToken as unknown as Token] *= getRandomArbitrary(1 - params.volatility, 1)
                            }
                        }
                    }
                }
            }
        }
    }

    results.sort((a, b) => a - b)

    const median = (results[repetitions / 2 - 1] + results[repetitions / 2]) / 2
    const lower = (results[repetitions / 4 - 1] + results[repetitions / 4]) / 2
    const upper = (results[repetitions * 3 / 4 - 1] + results[repetitions * 3 / 4]) / 2

    const iqr = upper - lower
    const lowerBound = lower - 1.5 * iqr
    const upperBound = upper + 1.5 * iqr

    let minimum = 0
    for (let i = 0; i < results.length; i++) {
        const el = results[i]
        if (el < lowerBound) { continue }

        minimum = el
        break
    }

    let maximum = 0
    for (let i = results.length - 1; i >= 0; i--) {
        const el = results[i]
        if (el > upperBound) { continue }

        maximum = el
        break
    }

    return {
        median,
        lower,
        upper,
        "minimum": results[0],
        "maximum": results[results.length - 1],
    }
}

function getRandomArbitrary(min: number, max: number) {
    return Math.random() * (max - min) + min;
}
