// @flow

import * as graphlib from "graphlib";
import uuidv4 from "uuid/v4";

import type { P5Type } from "../types/p5Types";
import type ImageManager from "./ImageManager";


export default class TraceManager {

    p: any;
    g: any;
    im: ImageManager;
    nodesByLayer: Array<Array<string>>;
    edgesByLayer: Array<Array<any>>;
    prevNode: any;

    drawHinting: boolean;
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
        // If right click, select a node under the cursor:
        if (this.p.mouseButton === this.p.RIGHT) {
            // Get the closest node and set it as active:
            // TODO: Filter in here
            let closeNodes = this.g.nodes().map(n => this.g.node(n));
            closeNodes.sort((n, m) => {
                n = this.transformCoords(n.x, n.y);
                m = this.transformCoords(m.x, m.y);
                let ndist = (
                    Math.pow(this.p.mouseX - n.x, 2) +
                    Math.pow(this.p.mouseY - n.y, 2)
                );
                let mdist = (
                    Math.pow(this.p.mouseX - m.x, 2) +
                    Math.pow(this.p.mouseY - m.y, 2)
                );
                // return m.x;
                return ndist - mdist;
            });
            // TODO: Pick smarter than this
            if (closeNodes.length) {
                let n = closeNodes[0];
                this.prevNode = n;
            }
        } else {
            this.drawHinting = true;
        }
    }

    mouseClicked(): void {
        if (this.im.imageCollision(this.p.mouseX, this.p.mouseY)) {

            let newNodeId = uuidv4();
            this.nodesByLayer[this.im.currentZ].push(newNodeId);

            // Normalize relative to the original image.
            let x = (this.p.mouseX - this.im.position.x)/this.im.scale;
            let y = (this.p.mouseY - this.im.position.y)/this.im.scale;

            let newNode = new NodeMeta({
                x,
                y,
                z: this.im.currentZ,
                //!!!TEMP
                // TODO
                author: "Tucker Chapin",
                id: newNodeId
            });

            // TODO: Project xyz into DATA space, not p5 space
            this.g.setNode(newNodeId, newNode);

            // Create an edge to the previous node.
            if (this.prevNode) {
                let newEdge = {v: newNodeId, w: this.prevNode.id};
                this.g.setEdge(newEdge);
                this.edgesByLayer[this.im.currentZ].push(newEdge);
                this.edgesByLayer[this.prevNode.z].push(newEdge);
            }
            this.prevNode = newNode;
        }

        this.drawHinting = false;
    }

    // Denormalize the node to scale it to the correct position.
    // Returns SCREEN position
    transformCoords(x: number, y: number) {
        return {
            x: (x * this.im.scale) + this.im.position.x,
            y: (y * this.im.scale) + this.im.position.y,
        };
    }

    draw(): void {
        // While the mouse is down, but not released
        // Draw a transparent node and edge showing where they will appear on release.
        if (this.drawHinting) {
            if (this.prevNode) {
                let lastNode = this.transformCoords(this.prevNode.x, this.prevNode.y);
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
            this.p.noStroke();
            this.p.fill(`rgba(255, 0, 0, ${diminishingFactor * .5})`);
            for (let i = 0; i < this.nodesByLayer[j].length; i++) {
                let node = this.g.node(this.nodesByLayer[j][i]);
                let transformedNode = this.transformCoords(node.x, node.y);
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
            let transformedNode = this.transformCoords(node.x, node.y);
            this.p.ellipse(transformedNode.x, transformedNode.y, 10, 10);
        }

        // Draw the currently active node
        this.p.fill("#FF0");
        this.p.noStroke();
        if (this.prevNode) {
            // TODO: Fade with depth
            let transformedNode = this.transformCoords(this.prevNode.x, this.prevNode.y);
            this.p.ellipse(transformedNode.x, transformedNode.y, 10, 10);
        }
    }

}

// Thin wrapper for node information.
class NodeMeta {
    id: string;
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
        id?: string
    }) {
        this.x = opts.x;
        this.y = opts.y;
        this.z = opts.z;
        this.author = opts.author || undefined;
        this.created = opts.created || new Date();
        this.id = opts.id || uuidv4();
    }
}
