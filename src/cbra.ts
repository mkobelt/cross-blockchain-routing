type IndexedBlockchain<B> = {
    index: number
    blockchain: B
}

export type Arc<B, D> = {
    "from": B
    "to": B
    "details": D
}

export type Hop<B, D, L> = {
    readonly arc: Arc<B, D>
    readonly labels: [from: L, to: L]
}

export class CBRA<B, D> {
    public readonly N: number
    public readonly M: number

    private readonly V: IndexedBlockchain<B>[]
    private readonly A: Arc<IndexedBlockchain<B>, D>[]

    /**
     * Constructs a new CBRN with the given blockchains and arcs.
     * Note that the arcs have to refer to the same memory locations as in the blockchains parameter.
     * @param blockchains the blockchains of the CBRN
     * @param arcs the arcs connecting the blockchains
     */
    constructor(blockchains: B[], arcs: Arc<B, D>[]) {
        const findBlockchain = (blockchain: B): IndexedBlockchain<B> => {
            const indexedBlockchain = this.findBlockchain(blockchain)

            if (indexedBlockchain === null) {
                throw new Error("arc involves a blockchain not present in the CBRN")
            }

            return indexedBlockchain
        }

        this.V = blockchains.map((blockchain, i) => ({"index": i, blockchain}))
        this.A = arcs.map(arc => ({
            "from": findBlockchain(arc.from),
            "to": findBlockchain(arc.to),
            "details": arc.details,
        }))

        this.N = this.V.length
        this.M = this.A.length
    }

    /**
     * Iteratively computes a route from a source to a destination blockchain.
     * Intermediate results are yielded such that the user can decide when to continue the route computation.
     * In practice, this should be used to account for transaction times and possibly updated network conditions. 
     * @param from the source blockchain (has to be strictly equal to one of the blockchains given in the constructor)
     * @param to the destination blockchain (has to be strictly equal to one of the blockchains given in the constructor)
     * @param startLabel the starting value of the input (e.g. a cross-blockchain swap may use this parameter to set the amount of input tokens)
     * @param worstLabel the worst possible label that a route can obtain, used as an initial label for all blockchains
     * @param label a function that, given a transaction and a label from the transaction's source, computes the label of the transaction's destination if it were to be executed
     * @param improves a function that determines whether the first label is better than the other (e.g. in cases where the value type is numeric this could simply be a<b or a>b)
     * @returns a generator that yields the next transaction to be taken until the destination has been reached
     */
    public *computeRoute<L>(
        from: B,
        to: B,
        startLabel: L,
        worstLabel: L,
        label: (arc: Arc<B, D>, startLabel: L) => L,
        improves: (newLabel: L, currentLabel: L) => boolean,
    ): Generator<Hop<B, D, L>, void, void> {
        let fromIndexed = this.findBlockchain(from)
        let toIndexed = this.findBlockchain(to)

        if (fromIndexed === null) {
            throw new Error(`source blockchain ${from} not found in CBRN`)
        }
        if (toIndexed === null) {
            throw new Error(`destination blockchain ${to} not found in CBRN`)
        }

        while (fromIndexed !== toIndexed) {
            const labels: L[] = Array(this.N).fill(worstLabel)
            const predecessor: (number | null)[] = Array(this.N).fill(null)

            labels[fromIndexed.index] = startLabel

            for (let i = 1; i < this.M; i++) {
                let improvedThisRound = false

                for (let j = 0; j < this.M; j++) {
                    const arc = this.A[j]
                    const [u, v] = [arc.from.index, arc.to.index]
                    const newLabel = label(stripArc(arc), labels[u])
                    if (improves(newLabel, labels[v])) {
                        improvedThisRound = true
                        labels[v] = newLabel
                        predecessor[v] = j
                    }
                }

                if (!improvedThisRound) {
                    break
                }
            }

            for (let i = 0; i < this.M; i++) {
                const arc = this.A[i]
                const [u, v] = [arc.from.index, arc.to.index]
                if (improves(label(stripArc(arc), labels[u]), labels[v])) {
                    throw new Error("Graph contains a weighted cycle")
                }
            }

            let nextArc: Arc<IndexedBlockchain<B>, D>
            let nextBlockchain = toIndexed
            do {
                const prevEdge = predecessor[nextBlockchain.index]
                if (prevEdge === null) {
                    throw new Error("Target blockchain not reachable")
                }

                nextArc = this.A[prevEdge]
                nextBlockchain = nextArc.from
            } while (nextBlockchain.index !== fromIndexed.index)

            yield {
                "arc": stripArc(nextArc),
                "labels": [startLabel, labels[nextArc.to.index]],
            };

            fromIndexed = nextArc.to
            startLabel = labels[fromIndexed.index]
        }
    }

    private findBlockchain(blockchain: B): IndexedBlockchain<B> | null {
        return this.V.find(indexedBlockchain => indexedBlockchain.blockchain === blockchain) ?? null
    }
}

function stripArc<B, D>(arc: Arc<IndexedBlockchain<B>, D>): Arc<B, D> {
    return {
        "from": arc.from.blockchain,
        "to": arc.to.blockchain,
        "details": arc.details,
    }
}
