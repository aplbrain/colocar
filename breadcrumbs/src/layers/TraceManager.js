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
// Color of the starting synapse
const STARTING_SYNAPSE_COLOR = { r: 0, g: 255, b: 0 };
// Color of a node that has been marked as a bookmark
const BOOKMARK_COLOR = { r: 255, g: 0, b: 255 };
// Default node color
const DEFAULT_COLOR = { r: 90, g: 200, b: 90 };
// Default edge color
const EDGE_COLOR = { r: 60, g: 170, b: 60 };

// Radius of an axon marker
const AXON_RADIUS = 25;
// Radius of a marker for a node that is marked as a bookmark
const BOOKMARK_RADIUS = 25;
// Radius of a dendrite marker
const DENDRITE_RADIUS = 25;
// Radius of the default marker for a neuron
const DEFAULT_RADIUS = 7;

// Distance in pixels outside of which a node is not selectable
const SELECTION_THRESHOLD = 15;
// Number of z-slices after which a node is no longer selectable
const SELECTION_RADIUS_Z = 20;


export default class TraceManager {

    p: any;
    g: any;
    im: ImageManager;
    activeNode: NodeMeta;
    nodeStack: Array<NodeMeta>;

    drawHinting: boolean;
    visibility: boolean;
    newSubgraph: boolean;

    constructor(opts: {
        p: P5Type,
        imageManager: ImageManager,
        startingGraph: Object,
        activeNodeId: string
    }) {
        this.p = opts.p;
        this.im = opts.imageManager;
        this.g = new graphlib.Graph({
            directed: true
        });

        window.tm = this;
        this.drawHinting = false;
        this.visibility = true;

        // Contain all previous nodes as added, in order. This enables
        // a "popping" action when deleting nodes.
        this.nodeStack = [];

        if (opts.startingGraph) {
            // TODO: Allow arbitrary graph instead of single-node graph
            this.insertGraph(
                opts.startingGraph,
                opts.activeNodeId
            );
        } else {
            throw "Must supply a starting graph";
        }
    }

    exportGraph(): Object {
        /*
        Remap nodes to data-space and return COPY OF graph.
        */
        let graphCopy = graphlib.json.read(graphlib.json.write(this.g));
        return graphCopy;
    }

    getSelectedNodeZ(): number {
        if (this.activeNode) {
            return this.activeNode.z;
        } else {
            return this.im.currentZ;
        }
    }

    stopHinting(): void {
        this.drawHinting = false;
    }

    toggleVisibility(): void {
        console.log(this.visibility);
        this.visibility = !this.visibility;
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
                this.nodeStack.push(this.activeNode);
                this.activeNode = n;
            }
        } else {
            this.drawHinting = true;
        }
    }

    insertGraph(graph: Object, activeNodeId: string) {
        graph.nodes.forEach(n => {
            n.id = n.id || uuidv4();
            this.g.setNode(n.id, n);
        });
        if (this.g.nodeCount() === 1) {
            let startingSynapseId = this.g.nodes()[0];
            let startingSynapse = this.g.node(startingSynapseId);
            startingSynapse.protected = true;
            startingSynapse.type = "initial";
            this.g.setNode(startingSynapseId, startingSynapse);
        }
        // graph.links.forEach(l => {
        //     this.g.setEdge();
        // });
        this.activeNode = this.g.node(activeNodeId);
    }

    extendGraph(newNodeId: string, newNode: NodeMeta): void {
        newNodeId = newNodeId || uuidv4();
        // Verify that the node IDs line up
        newNode.id = newNodeId;
        this.g.setNode(newNodeId, newNode);

        // Create an edge from the active node.
        if (this.activeNode) {
            let newEdge = {
                v: this.activeNode.id,
                w: newNodeId
            };
            this.g.setEdge(newEdge);
            this.nodeStack.push(this.activeNode);
        } else {
            throw "No active node. Ask an admin.";
        }
        this.activeNode = newNode;
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

            this.extendGraph(newNodeId, newNode);
        }

        this.drawHinting = false;
    }

    markNodeType(nodeType: string): void {
        let node = this.g.node(this.activeNode.id)
        if (!node.protected) {
            if (node.type == nodeType) {
                node.type = undefined;
            } else {
                node.type = nodeType;
            }
            this.g.setNode(this.activeNode.id, node)
        }
    }

    markBookmark(): void {
        if (this.g.node(this.activeNode.id).bookmarked) {
            this.g.node(this.activeNode.id).bookmarked = false;
        } else {
            this.g.node(this.activeNode.id).bookmarked = true;
        }
    }

    popBookmark(): {x: number, y: number, z: number} {
        let bmarks = this.nodeStack.reverse().filter(n => n.bookmarked);
        if (!bmarks.length) {
            // If you have set no bookmarks, return current XYZ
            return {
                x: this.activeNode.x,
                y: this.activeNode.y,
                z: this.activeNode.z,
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
        if (!this.activeNode) {
            return;
        }

        if (this.activeNode.protected) {
            return;
        }

        if (this.g.neighbors(this.activeNode.id).length > 1) {
            return;
        }

        // Delete from graph
        this.g.removeNode(this.activeNode.id);
        // Assign new last-node to `activeNode`
        this.nodeStack = this.nodeStack.filter(n => n.id !== this.activeNode.id);
        this.activeNode = this.nodeStack.pop();
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
        if (!this.visibility) {
            return;
        }

        // While the mouse is down, but not released
        // Draw a transparent node and edge showing where they will appear on release.
        if (this.drawHinting) {
            if (this.activeNode) {
                let lastNode = this.transformCoords(this.activeNode.x, this.activeNode.y);
                this.p.strokeWeight(3);
                this.p.stroke("rgba(0, 0, 0, .5)");
                this.p.line(lastNode.x, lastNode.y, this.p.mouseX, this.p.mouseY);
            }
            this.p.fill("rgba(255, 0, 0, 0.5)");
            this.p.noStroke();
            this.p.ellipse(this.p.mouseX, this.p.mouseY, 10, 10);
        }

        this.p.noStroke();

        // Draw nodes
        for (let node of this.g.nodes().map(n => this.g.node(n))) {
            let nodePos = this.transformCoords(node.x, node.y);

            let color = DEFAULT_COLOR;
            let radius = DEFAULT_RADIUS;

            if (node.bookmarked) {
                color = BOOKMARK_COLOR;
                radius = BOOKMARK_RADIUS;
            } else if (node.type === "initial") {
                color = STARTING_SYNAPSE_COLOR;
                radius = BOOKMARK_RADIUS;
            } else if (node.type === "presynaptic") {
                color = AXON_COLOR;
                radius = AXON_RADIUS;
            } else if (node.type === "postsynaptic") {
                color = DENDRITE_COLOR;
                radius = DENDRITE_RADIUS;
            } else {
                color = DEFAULT_COLOR;
                radius = DEFAULT_RADIUS;
            }

            this.p.fill(
                color.r, color.g, color.b,
                (255 - (Math.pow(node.z - this.im.currentZ, 2)))
            );
            this.p.ellipse(nodePos.x, nodePos.y, radius, radius);
        }

        // Draw edges
        for (let {v,w} of this.g.edges().map(({v, w}) => {
            return {v: this.g.node(v), w: this.g.node(w)};
        })) {
            let nodePosU = this.transformCoords(v.x, v.y);
            let nodePosV = this.transformCoords(w.x, w.y);

            if (Math.abs(w.z - this.im.currentZ) > SELECTION_RADIUS_Z) {
                let diminishingFactor = (v.z + 1) / (this.im.currentZ + 1);
                // TODO: I'm exhausted but this is dumb, do better
                if (diminishingFactor > 1) {
                    diminishingFactor = 1 / diminishingFactor;
                }
                this.p.strokeWeight(3 * diminishingFactor);
                this.p.stroke(`rgba(0, 0, 0, ${diminishingFactor * .5})`);
            } else {
                this.p.strokeWeight(3);
                this.p.stroke(EDGE_COLOR.r, EDGE_COLOR.g, EDGE_COLOR.b);
            }
            this.p.line(nodePosU.x, nodePosU.y, nodePosV.x, nodePosV.y);
        }

        // Draw the currently active node
        this.p.noStroke();
        if (this.activeNode) {
            this.p.fill(
                ACTIVE_NODE_COLOR.r,
                ACTIVE_NODE_COLOR.g,
                ACTIVE_NODE_COLOR.b,
                255 - (Math.pow(this.activeNode.z - this.im.currentZ, 2) - 20)
            );
            let transformedNode = this.transformCoords(this.activeNode.x, this.activeNode.y);
            this.p.ellipse(transformedNode.x, transformedNode.y, 20, 20);
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
    bookmarked: ?boolean;
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
