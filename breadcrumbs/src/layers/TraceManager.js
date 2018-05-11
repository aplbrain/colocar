// @flow
import * as graphlib from "graphlib";
import uuidv4 from "uuid/v4";

import type { P5Type } from "./types/p5Types";

export default class TraceManager {

    p: any;
    g: any;
    im: ImageManager;
    nodesByLayer: Array<Array<string>>;
    edgesByLayer: Array<Array<any>>;

    drawHintingLine: boolean;
    newSubgraph: boolean;

    constructor(opts: {p: P5Type, imageManager: ImageManager}) {
        this.p = opts.p;
        this.im = opts.imageManager;
        this.g = new graphlib.Graph({directed: false});
        this.drawHinting = false;

        // Stores the node IDs by layer.
        this.nodesByLayer = new Array(this.im.images.length);
        for (let i = 0; i < this.nodesByLayer.length; i++) {
            this.nodesByLayer[i] = [];
        }

        // Stores the edges by layer (edges can appear twice, if they span layers).
        this.edgesByLayer = new Array(this.im.images.length);
        for (let i = 0; i < this.edgesByLayer.length; i++) {
            this.edgesByLayer[i] = [];
        }
    }

    mousePressed(): void {
        this.drawHinting = true;
    }

    mouseClicked(): void {
        if (this.im.imageCollision(this.p.mouseX, this.p.mouseY)) {
            let newNodeId = uuidv4();
            this.nodesByLayer[this.im.currentZ].push(newNodeId);

            // Normalize relative to the original image.
            let x = (this.p.mouseX - this.im.position.x)/this.im.scale;
            let y = (this.p.mouseY - this.im.position.y)/this.im.scale;

            let prevNode;
            if (this.g.nodes().length > 0) {
                prevNode = this.g.nodes()[this.g.nodes().length - 1];
            }

            this.g.setNode(newNodeId, new NodeMeta({
                x,
                y,
                z: this.im.currentZ,
                //!!!TEMP
                author: "Tucker Chapin",
            }));

            // Create an edge to the previous node.
            if (prevNode) {
                let newEdge = {v: newNodeId, w:  prevNode};
                this.g.setEdge(newEdge);
                this.edgesByLayer[this.im.currentZ].push(newEdge);
                this.edgesByLayer[this.g.node(prevNode).z].push(newEdge);
            }
        }

        this.drawHinting = false;
    }

    // Denormalize the node to scale it to the correct position.
    transformCoords(x: number, y: number) {
        return {
            x: (x * this.im.scale) + this.im.position.x,
            y: (y * this.im.scale) + this.im.position.y,
        };
    }

    draw(): void {
        // While the mouse is down, but not released
        // Draw a transparent node and edge showing where they will apear on release.
        if (this.drawHinting) {
            if (this.g.nodes().length > 0) {
                let lastNode = this.g.node(this.g.nodes()[this.g.nodes().length - 1]);
                lastNode = this.transformCoords(lastNode.x, lastNode.y)
                this.p.strokeWeight(3);
                this.p.stroke("rgba(0, 0, 0, .5)");
                this.p.line(lastNode.x, lastNode.y, this.p.mouseX, this.p.mouseY);
            }
            this.p.fill("rgba(255, 0, 0, 0.5)");
            this.p.noStroke();
            this.p.ellipse(this.p.mouseX, this.p.mouseY, 10, 10);
        }

        this.p.noStroke();
        // Draw all the nodes and edges in the previous layers.
        for (let j = 0; j < this.im.currentZ; j++) {
            // Make "far away" nodes and edges fade into the distance.
            let diminishingFactor = (j + 1) / (this.im.currentZ + 1);

            // edges
            this.p.strokeWeight(3 * diminishingFactor);
            this.p.stroke(`rgba(0, 0, 0, ${diminishingFactor * .5})`);
            for (let i = 0; i < this.edgesByLayer[j].length; i++) {
                let edge = this.edgesByLayer[j][i];
                let transformedNodeV = this.transformCoords(this.g.node(edge.v).x, this.g.node(edge.v).y);
                let transformedNodeW = this.transformCoords(this.g.node(edge.w).x, this.g.node(edge.w).y);
                this.p.line(transformedNodeV.x, transformedNodeV.y, transformedNodeW.x, transformedNodeW.y);
            }

            // nodes
            this.p.fill(`rgba(255, 0, 0, ${diminishingFactor * .5})`);
            this.p.noStroke();
            for (let i = 0; i < this.nodesByLayer[j].length; i++) {
                let node = this.g.node(this.nodesByLayer[j][i]);
                let transformedNode = this.transformCoords(node.x, node.y)
                this.p.ellipse(transformedNode.x, transformedNode.y, diminishingFactor * 10, diminishingFactor * 10);
            }
        }

        this.p.strokeWeight(3);
        this.p.stroke("#000");
        // Draw all the edges with a node in the current layer.
        for (let i = 0; i < this.edgesByLayer[this.im.currentZ].length; i++) {
            let edge = this.edgesByLayer[this.im.currentZ][i];
            let nodeV = this.g.node(edge.v);
            let nodeW = this.g.node(edge.w);
            let transformedNodeV = this.transformCoords(nodeV.x, nodeV.y);
            let transformedNodeW = this.transformCoords(nodeW.x, nodeW.y);
            this.p.line(transformedNodeV.x, transformedNodeV.y, transformedNodeW.x, transformedNodeW.y);
        }

        this.p.fill("#F00");
        this.p.noStroke();
        // Draw all the nodes in the current layer.
        for (let i = 0; i < this.nodesByLayer[this.im.currentZ].length; i++) {
            let node = this.g.node(this.nodesByLayer[this.im.currentZ][i]);
            let transformedNode = this.transformCoords(node.x, node.y)
            this.p.ellipse(transformedNode.x, transformedNode.y, 10, 10);
        }
    }
}

// Thin wrapper for node information.
class NodeMeta {
    // id: string;
    x: number;
    y: number;
    z: number;
    author: ?string;
    created: ?Date;

    constructor(opts: {
        x: number,
        y: number,
        z: number,
        author?: string,
        created?: Date,
        // id?: string
    }) {
        this.x = opts.x;
        this.y = opts.y;
        this.z = opts.z;
        this.author = opts.author || undefined;
        this.created = opts.created || new Date();
        // this.id = opts.id || uuidv4();
    }
}
