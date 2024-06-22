import cytoscape from "cytoscape";
import assert from "node:assert/strict";
import { AsyncOrSync } from "ts-essentials";

export type BlockchainDataState<T = undefined> = {
    readonly id: number;
    readonly blockchain: string;
    readonly dataState: T;
}

export type Transaction<T> = {
    readonly id: number;
    readonly edge: [from: BlockchainDataState<T>, to: BlockchainDataState<T>];
}

export type CBRAResult<T, V> = {
    readonly tx: Transaction<T>;
    readonly values: [from: V, to: V];
}

export class CBRA<T, V> {
    constructor(
        private readonly nodes: BlockchainDataState<T>[],
        private readonly edges: Transaction<T>[],
        private readonly acc: (currentValue: V, transaction: Transaction<T>) => V,
        private readonly improves: (newValue: V, currentValue: V) => boolean,
        private readonly worstValue: V,
    ) {}

    public async *computeRoute(from: BlockchainDataState<T>, to: BlockchainDataState<T>, startValue: V): AsyncGenerator<CBRAResult<T, V>, void, void> {
        while (from !== to) {
            const V = this.nodes.length;
            const values: V[] = Array(V).fill(this.worstValue);
            const predecessor: (number | null)[] = Array(V).fill(null);

            values[from.id] = startValue;

            // TODO V-1 iterations are sufficient to find a path in a simple graph, but what about multigraphs?
            for (let i = 1; i < V; i++) {
                for (const tx of this.edges) {
                    const [u, v] = tx.edge.map(({id}) => id);
                    const newVal = this.acc(values[u], tx);
                    if (this.improves(newVal, values[v])) {
                        values[v] = newVal;
                        predecessor[v] = tx.id;
                    }
                }
            }

            for (const edge of this.edges) {
                let [u, v] = edge.edge.map(({id}) => id);
                if (this.improves(this.acc(values[u], edge), values[v])) {
                    throw new Error("Graph contains a weighted cycle");
                }
            }

            let nextTx: Transaction<T>;
            let nextNode = to;
            do {
                const prevEdge = predecessor[nextNode.id];
                if (prevEdge === null) {
                    throw new Error("Target node not reachable");
                }

                nextTx = this.edges[prevEdge];
                nextNode = nextTx.edge[0];
            } while (nextNode.id !== from.id);

            yield {
                "tx": nextTx,
                "values": [startValue, values[nextTx.edge[1].id]],
            };

            from = nextTx.edge[1];
            startValue = values[from.id];
        }
    }
}
