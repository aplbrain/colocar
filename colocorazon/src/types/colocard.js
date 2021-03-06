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

export type NodeDecision = {
    author: string,
    decision: string,
    date: number
}

export type Question = {
    assignee: string,
    author: string,
    instructions: Object,
    namespace: string,
    priority: number,
    volume: string
}

export type Volume = {
    author: string,
    bounds: [[number]],
    name: string,
    namespace: string,
    resolution: number,
    uri: string
}
