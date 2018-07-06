// @flow

import * as graphlib from "graphlib";
import uuidv4 from "uuid/v4";

import type { P5Type } from "../types/p5Types";
import type ImageManager from "./ImageManager";

// Color of node marked as axon
const AXON_COLOR = { r: 255, g: 0, b: 0 };
// Color of node marked as dendrite
const DENDRITE_COLOR = { r: 0, g: 255, b: 255 };
// Color of the currently selected node "highlight" area
const ACTIVE_NODE_COLOR = { r: 255, g: 255, b: 0 };
// Color of a node that has been marked as a bookmark
const BOOKMARK_COLOR = { r: 255, g: 0, b: 255 };
// Default node color
const DEFAULT_COLOR = { r: 90, g: 200, b: 90 };
// Default edge color
const EDGE_COLOR = { r: 60, g: 170, b: 60 };

// Radius of an axon marker
const AXON_RADIUS = 10;
// Radius of a marker for a node that is marked as a bookmark
const BOOKMARK_RADIUS = 10;
// Radius of a dendrite marker
const DENDRITE_RADIUS = 10;
// Radius of the default marker for a neuron
const DEFAULT_RADIUS = 5;

// Distance in pixels outside of which a node is not selectable
const SELECTION_THRESHOLD = 15;
// Number of z-slices after which a node is no longer selectable
const SELECTION_RADIUS_Z = 6;


export default class TraceManager {

    p: any;
    g: any;
    im: ImageManager;
    nodesByLayer: Array<Array<string>>;
    edgesByLayer: Array<Array<any>>;
    prevNode: NodeMeta;
    nodeStack: Array<NodeMeta>;

    drawHinting: boolean;
    newSubgraph: boolean;

    constructor(opts: {
        p: P5Type,
        imageManager: ImageManager,
        startingGraph: Object
    }) {
        this.p = opts.p;
        this.im = opts.imageManager;
        this.g = new graphlib.Graph({
            directed: false
        });

        window.tm = this;
        this.drawHinting = false;

        // Contain all previous nodes as added, in order. This enables
        // a "popping" action when deleting nodes.
        this.nodeStack = [];

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

        if (opts.startingGraph) {
            // TODO: Allow arbitrary graph instead of single-node graph
            this.addNode(
                opts.startingGraph.nodes[0].v,
                opts.startingGraph.nodes[0].value
            );
        }
    }

    getSelectedNodeZ(): number {
        if (this.prevNode) {
            return this.prevNode.z;
        } else {
            return this.im.currentZ;
        }
    }

    mousePressed(): void {
        // If right click, select a node under the cursor:
        if (this.p.mouseButton === this.p.RIGHT) {
            // Get the closest node and set it as active:
            // TODO: Filter in here
            let closeNodes = this.g.nodes()
                .map(n => this.g.node(n))
                .filter(n => Math.abs(n.z - this.im.currentZ) < SELECTION_RADIUS_Z)
                .filter(n => {
                    n = this.transformCoords(n.x, n.y);
                    return Math.sqrt(
                        Math.pow(this.p.mouseX - n.x, 2) +
                        Math.pow(this.p.mouseY - n.y, 2)
                    ) < SELECTION_THRESHOLD;
                });
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
                this.nodeStack.push(this.prevNode);
                this.prevNode = n;
            }
        } else {
            this.drawHinting = true;
        }
    }

    addNode(newNodeId: string, newNode: NodeMeta): void {
        // Verify that the node IDs line up
        newNode.id = newNodeId;
        this.g.setNode(newNodeId, newNode);

        this.nodesByLayer[Math.round(newNode.z)].push(newNodeId);

        // Create an edge to the previous node.
        if (this.prevNode) {
            let newEdge = {
                v: newNodeId,
                w: this.prevNode.id
            };
            this.g.setEdge(newEdge);
            this.edgesByLayer[newNode.z].push(newEdge);
            this.edgesByLayer[this.prevNode.z].push(newEdge);
            this.nodeStack.push(this.prevNode);
        } else {
            this.nodeStack.push(newNode);
        }
        this.prevNode = newNode;
    }

    mouseClicked(): void {
        if (this.im.imageCollision(this.p.mouseX, this.p.mouseY)) {

            let newNodeId = uuidv4();

            // Normalize relative to the original image.
            let x = (this.p.mouseX - this.im.position.x)/this.im.scale;
            let y = (this.p.mouseY - this.im.position.y)/this.im.scale;

            // TODO: Project xyz into DATA space, not p5 space
            let newNode = new NodeMeta({
                x,
                y,
                z: this.im.currentZ,
                id: newNodeId
            });

            this.addNode(newNodeId, newNode);
        }

        this.drawHinting = false;
    }

    markAxon(): void {
        this.g.node(this.prevNode.id).type = "presynaptic";
    }
    markDendrite(): void {
        this.g.node(this.prevNode.id).type = "postsynaptic";
    }
    markBookmark(): void {
        if (this.g.node(this.prevNode.id).bookmarked) {
            this.g.node(this.prevNode.id).bookmarked = false;
        } else {
            this.g.node(this.prevNode.id).bookmarked = true;
        }
    }

    popBookmark(): {x: number, y: number, z: number} {
        let bmarks = this.nodeStack.reverse().filter(n => n.bookmarked);
        if (!bmarks.length) {
            // If you have set no bookmarks, return current XYZ
            return {
                x: this.prevNode.x,
                y: this.prevNode.y,
                z: this.prevNode.z,
            };
        } else {
            return {
                x: bmarks[0].x,
                y: bmarks[0].y,
                z: bmarks[0].z,
            };
        }
    }

    deleteActiveNode(): void {
        if (!this.prevNode) {
            return;
        }

        if (this.prevNode.protected) {
            return;
        }

        // Delete from edgesByLayer
        // Get layers:
        for (let v of this.g.neighbors(this.prevNode.id)) {
            this.edgesByLayer[this.g.node(v).z] = this.edgesByLayer[this.g.node(v).z].filter(e => {
                return e.v !== this.prevNode.id && e.w !== this.prevNode.id;
            });
        }
        // Delete from nodesByLayer
        this.nodesByLayer[this.prevNode.z] = this.nodesByLayer[this.prevNode.z].filter(nid => nid !== this.prevNode.id);
        // Delete from graph
        this.g.removeNode(this.prevNode.id);
        // Assign new last-node to `prevNode`
        this.nodeStack = this.nodeStack.filter(n => n.id !== this.prevNode.id);
        this.prevNode = this.nodeStack.pop();
    }

    // Denormalize the node to scale it to the correct position.
    // Returns SCREEN position
    transformCoords(x: number, y: number) {
        return {
            x: (x * this.im.scale) + this.im.position.x,
            y: (y * this.im.scale) + this.im.position.y,
        };
    }

    // Screen to IMAGE position
    normalizeCoords(x: number, y: number) {
        return {
            x: (x - this.im.position.x) / this.im.scale,
            y: (y - this.im.position.y) / this.im.scale,
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
        for (let j = 0; j < this.im.maxZ(); j++) {
            // Make "far away" nodes and edges fade into the distance.
            let diminishingFactor = (j + 1) / (this.im.currentZ + 1);
            // TODO: I'm exhausted but this is dumb, do better
            if (diminishingFactor > 1) { diminishingFactor = 1/diminishingFactor; }

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
            for (let i = 0; i < this.nodesByLayer[j].length; i++) {
                let node = this.g.node(this.nodesByLayer[j][i]);
                let color = DEFAULT_COLOR;
                switch (node.type) {
                case "presynaptic":
                    color = AXON_COLOR;
                    break;
                case "postsynaptic":
                    color = DENDRITE_COLOR;
                    break;
                default:
                    break;
                }
                if (node.bookmarked) {
                    color = BOOKMARK_COLOR;
                }
                this.p.fill(color.r, color.g, color.b, diminishingFactor * .5);
                let transformedNode = this.transformCoords(node.x, node.y);
                this.p.ellipse(transformedNode.x, transformedNode.y, diminishingFactor * 10, diminishingFactor * 10);
            }
        }

        this.p.strokeWeight(3);
        this.p.stroke(EDGE_COLOR.r, EDGE_COLOR.g, EDGE_COLOR.b);
        // Draw all the edges with a node in the current layer.
        for (let i = 0; i < this.edgesByLayer[this.im.currentZ].length; i++) {
            let edge = this.edgesByLayer[this.im.currentZ][i];
            let nodeV = this.g.node(edge.v);
            let nodeW = this.g.node(edge.w);
            let transformedNodeV = this.transformCoords(nodeV.x, nodeV.y);
            let transformedNodeW = this.transformCoords(nodeW.x, nodeW.y);
            this.p.line(transformedNodeV.x, transformedNodeV.y, transformedNodeW.x, transformedNodeW.y);
        }

        // Draw the currently active node
        this.p.noStroke();
        if (this.prevNode) {
            this.p.fill(
                ACTIVE_NODE_COLOR.r,
                ACTIVE_NODE_COLOR.g,
                ACTIVE_NODE_COLOR.b,
                255 - (Math.pow(this.prevNode.z - this.im.currentZ, 2))
            );
            // TODO: Fade with depth
            let transformedNode = this.transformCoords(this.prevNode.x, this.prevNode.y);
            this.p.ellipse(transformedNode.x, transformedNode.y, 20, 20);
        }

        this.p.noStroke();
        // Draw all the nodes in the current layer.
        for (let i = 0; i < this.nodesByLayer[this.im.currentZ].length; i++) {
            let node = this.g.node(this.nodesByLayer[this.im.currentZ][i]);
            let color = DEFAULT_COLOR;
            let radius = DEFAULT_RADIUS;
            if (node.type === "presynaptic") {
                color = AXON_COLOR;
                radius = AXON_RADIUS;
            } else if (node.type === "postsynaptic") {
                color = DENDRITE_COLOR;
                radius = DENDRITE_RADIUS;
            }
            if (node.bookmarked) {
                color = BOOKMARK_COLOR;
                radius = BOOKMARK_RADIUS;
            }
            this.p.fill(color.r, color.g, color.b);
            let transformedNode = this.transformCoords(node.x, node.y);
            this.p.ellipse(transformedNode.x, transformedNode.y, radius, radius);
        }
    }

}

// Thin wrapper for node information.
class NodeMeta {
    id: string;
    x: number;
    y: number;
    z: number;
    type: ?string;
    author: ?string;
    created: ?Date;

    constructor(opts: {
        x: number,
        y: number,
        z: number,
        author?: string,
        created?: Date,
        type?: string,
        id?: string
    }) {
        this.x = opts.x;
        this.y = opts.y;
        this.z = opts.z;
        this.author = opts.author || undefined;
        this.type = opts.type || undefined;
        this.created = opts.created || new Date();
        this.id = opts.id || uuidv4();
    }
}
