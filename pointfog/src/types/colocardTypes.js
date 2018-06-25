
export type NodeDecision = {
    author: string,
    decision: string,
    date: number
}

export type Node = {
    active: boolean,
    author: string,
    coordinate: [number, number, number],
    created: number,
    decisions: ?Array<NodeDecision>,
    metadata: Object,
    namespace: string,
    submitted: number,
    type: string,
    volume: string,
}
