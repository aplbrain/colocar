// @flow

export type Graph = {
    nodes: Array<Node>;
    edges: Array<Edge>;
};

export type Node = {

    x: number;
    y: number;
    z: number;

    created: ?Date;
    author: ?string;
};

export type Edge = {

    x: number,
    y: number,
    z: number,

    created: Date,
    author: string

};
