import cytoscape from "cytoscape";
import assert from "node:assert/strict";
import { AsyncOrSync } from "ts-essentials";

export type BlockchainDataState<T = undefined> = {
    readonly blockchain: string;
} & (T extends undefined ? {} : {
    readonly dataState: T;
})

export type Transaction<T> = {
    readonly getWeight: () => AsyncOrSync<number>;
    readonly edge: [from: BlockchainDataState<T>, to: BlockchainDataState<T>];
}

export class CBRA<T> {
    private readonly graph = cytoscape();

    constructor(
        private readonly nodes: BlockchainDataState<T>[],
        private readonly edges: Transaction<T>[],
    ) {
        for (let i = 0; i < nodes.length; i++) {
            this.graph.add({
                "group": "nodes",
                "data": {
                    "id": `n${i}`,
                },
            });
        }

        for (let i = 0; i < edges.length; i++) {
            this.graph.add({
                "group": "edges",
                "data": {
                    "id": `e${i}`,
                    "source": `n${findIndex(nodes, edges[i].edge[0])}`,
                    "target": `n${findIndex(nodes, edges[i].edge[1])}`,
                }
            });
        }
    }

    public async *computeRoute(from: BlockchainDataState<T>, to: BlockchainDataState<T>): AsyncGenerator<Transaction<T>, void, void> {
        while (from !== to) {
            const weights = await Promise.all(
                this.edges.map(edge => edge.getWeight())
            );

            const res = this.graph.elements().bellmanFord({
                "directed": true,
                "root": `#n${findIndex(this.nodes, from)}`,
                "weight": e => weights[Number(e[0].id().substring(1))],
            });

            const path = res.pathTo(`#n${findIndex(this.nodes, to)}`);
            const next = this.edges[Number(path.edges()[0].id().substring(1))];
            yield next;

            from = next.edge[1];
        }
    }
}

function findIndex<T>(arr: T[], search: T): string {
    const i = arr.findIndex(e => e === search);
    assert.notEqual(i, -1);
    return i.toString();
}


