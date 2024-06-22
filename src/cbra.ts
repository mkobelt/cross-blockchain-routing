type IndexedBlockchain<T> = {
    index: number
    blockchain: T
}

export type Transaction<T> = [from: T, to: T]

export type CbraHop<T, V> = {
    readonly tx: Transaction<T>
    readonly values: [from: V, to: V]
}

export class Cbra<T> {
    public readonly N: number
    public readonly M: number

    private readonly V: IndexedBlockchain<T>[]
    private readonly E: Transaction<IndexedBlockchain<T>>[]

    /**
     * Constructs a new CBRA network with the given blockchains and transactions.
     * Note that the edges have to refer to the same JS values as in the nodes parameter.
     * @param blockchains the blockchains of the CBRA network
     * @param transactions the transactions connecting the blockchains
     */
    constructor(blockchains: T[], transactions: Transaction<T>[]) {
        this.V = blockchains.map((blockchain, i) => ({"index": i, blockchain}))
        this.E = transactions.map(tx =>
            tx.map(blockchain => {
                const indexedBlockchain = this.findBlockchain(blockchain)

                if (indexedBlockchain === null) {
                    throw new Error(`transaction "${tx}" involves a blockchain "${blockchain}" not present in the CBRA network`)
                }

                return indexedBlockchain
            })
        )

        this.N = this.V.length
        this.M = this.E.length
    }

    /**
     * Iteratively computes a route from a source to a destination blockchain.
     * Intermediate results are yielded such that the user can decide when to continue the route computation.
     * In practice, this should be used to account for transaction times and possibly updated network conditions. 
     * @param from the source blockchain (has to be strictly equal to one of the nodes given in the constructor)
     * @param to the destination blockchain (has to be strictly equal to one of the nodes given in the constructor)
     * @param startLabel the starting value of the input (e.g. a cross-blockchain swap may use this parameter to set the amount of input tokens)
     * @param worstLabel the worst possible label that a route can obtain, used to initialize the weights
     * @param label a function that, given a transaction and a label from the transaction's source, computes the label of the transaction's destination if it were to be executed
     * @param improves a function that determines whether the first label is better than the other (e.g. in cases where the value type is numeric this could simply be a<b or a>b)
     * @returns a generator that yields the next transaction to be taken until the destination has been reached
     */
    public *computeRoute<L>(
        from: T,
        to: T,
        startLabel: L,
        worstLabel: L,
        label: (tx: Transaction<T>, currentValue: L) => L,
        improves: (newValue: L, currentValue: L) => boolean,
    ): Generator<CbraHop<T, L>, void, void> {
        let fromIndexed = this.findBlockchain(from)
        let toIndexed = this.findBlockchain(to)

        if (fromIndexed === null) {
            throw new Error(`source blockchain ${from} not found in CBRA network`)
        }
        if (toIndexed === null) {
            throw new Error(`destination blockchain ${to} not found in CBRA network`)
        }

        while (fromIndexed !== toIndexed) {
            const values: L[] = Array(this.N).fill(worstLabel)
            const predecessor: (number | null)[] = Array(this.N).fill(null)

            values[fromIndexed.index] = startLabel

            for (let i = 1; i < this.N; i++) {
                for (let j = 0; j < this.M; j++) {
                    const tx = this.E[j]
                    const [u, v] = tx.map(({index}) => index)
                    const newVal = label(stripTransaction(tx), values[u])
                    if (improves(newVal, values[v])) {
                        values[v] = newVal
                        predecessor[v] = j
                    }
                }
            }

            for (let i = 0; i < this.M; i++) {
                const tx = this.E[i]
                const [u, v] = tx.map(({index}) => index)
                if (improves(label(stripTransaction(tx), values[u]), values[v])) {
                    throw new Error("Graph contains a weighted cycle")
                }
            }

            let nextTx: Transaction<IndexedBlockchain<T>>
            let nextNode = toIndexed
            do {
                const prevEdge = predecessor[nextNode.index]
                if (prevEdge === null) {
                    throw new Error("Target node not reachable")
                }

                nextTx = this.E[prevEdge]
                nextNode = nextTx[0]
            } while (nextNode.index !== fromIndexed.index)

            yield {
                "tx": stripTransaction(nextTx),
                "values": [startLabel, values[nextTx[1].index]],
            };

            fromIndexed = nextTx[1]
            startLabel = values[fromIndexed.index]
        }
    }

    private findBlockchain(blockchain: T): IndexedBlockchain<T> | null {
        return this.V.find(indexedBlockchain => indexedBlockchain.blockchain === blockchain) ?? null
    }
}

function stripTransaction<T>(tx: Transaction<IndexedBlockchain<T>>): Transaction<T> {
    return tx.map(({blockchain}) => blockchain)
}
