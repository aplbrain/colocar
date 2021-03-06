// @flow

import * as graphlib from "graphlib";
import uuidv4 from "uuid/v4";

import type { P5Type } from "colocorazon/dist/types/p5";
import Log from "colocorazon/dist/log";

import CHash from "colocorazon/dist/colorhash";

import type ImageManager from "./ImageManager";

const ACTIVE_NODE_COLOR = { r: 255, g: 255, b: 0 }; // yellow
// const STARTING_SYNAPSE_COLOR = { r: 0, g: 255, b: 0 }; // green
const BOOKMARK_COLOR = { r: 255, g: 0, b: 255 }; // purple
const DEFAULT_COLOR = { r: 90, g: 200, b: 90 }; // dark green
const EDGE_COLOR = { r: 60, g: 170, b: 60 }; // dark green
const CENTROID_COLOR = { r: 0, g: 0, b: 0 }; // dark black

const EDGE_WIDTH = 6;

// Radius of a marker when it has a node.type
const SPECIAL_RADIUS = 25;
// Radius of a marker for a node that is marked as a bookmark
const BOOKMARK_RADIUS = 20;
// Radius of the default marker for a neuron
const DEFAULT_RADIUS = 7;
// Radius of centroid marker
const CENTROID_RADIUS = 10;

// Distance in pixels outside of which a node is not selectable
const SELECTION_THRESHOLD = 15;
// Number of z-slices after which a node is no longer selectable
const SELECTION_RADIUS_Z = 5;


export default class TraceManager {

    p: any;
    g: any;
    im: ImageManager;
    activeNode: NodeMeta;
    DEFAULT_COLOR: ?Object;
    EDGE_COLOR: ?Object;

    nodeTypes: Array<string>;

    visibility: boolean;

    constructor(opts: {
        p: P5Type,
        imageManager: ImageManager,
        startingGraph: Object,
        DEFAULT_COLOR?: Object,
        EDGE_COLOR?: Object
    }) {
        this.p = opts.p;
        this.im = opts.imageManager;
        this.DEFAULT_COLOR = opts.DEFAULT_COLOR || DEFAULT_COLOR;
        this.EDGE_COLOR = opts.EDGE_COLOR || EDGE_COLOR;
        this.g = new graphlib.Graph({
            directed: true
        });

        // Inferred when a graph is loaded. Used to report to app
        // which colors should be listed.
        this.nodeTypes = [];

        window.tm = this;
        this.visibility = true;
    }

    getSelectedNodeZ(): number {
        if (this.activeNode) {
            return this.activeNode.z;
        } else {
            return this.im.currentZ;
        }
    }

    toggleVisibility(): void {
        this.visibility = !this.visibility;
    }

    getEntitiesForScrollbar() {
        return this.g.nodes().map(i => this.g.node(i)).concat({ ...this.activeNode, active: true });
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
                this.activeNode = n;
            }
        }
    }

    insertGraph(graph: Object, activeNodeId: string) {
        this.g = graph;
        this.nodeTypes = new Set(this.g.nodes().map(n => this.g.node(n)).filter(i => i.type).map(i => i.type));
        if (activeNodeId) {
            this.activeNode = this.g.node(activeNodeId);
        }
        else {
            this._assignActiveNodeAndProtect();
        }
    }

    _assignActiveNodeAndProtect() {
        // handle starting synapse
        if (this.g.nodeCount() === 1) {
            let startingSynapseId = this.g.nodes()[0];
            let startingSynapse = this.g.node(startingSynapseId);
            this.g.removeNode(startingSynapseId);
            startingSynapse.protected = true;
            startingSynapse.type = "initial";
            this.g.setNode(startingSynapseId, startingSynapse);
            this.activeNode = startingSynapse;
        }
        // handle parent graph
        else {
            let startingSynapse;
            let nodeIds = this.g.nodes();
            nodeIds.forEach(nodeId => {
                let node = this.g.node(nodeId);
                node.protected = true;
                this.g.setNode(nodeId, node);
                if (node.type === "initial") {
                    if (startingSynapse) {
                        Log.warn("more than one active node!");
                    } else {
                        startingSynapse = node;
                    }
                }
            });
            this.activeNode = startingSynapse;
        }
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

        this.p.noStroke();

        // Draw nodes
        for (let node of this.g.nodes().map(n => this.g.node(n))) {
            let nodePos = this.transformCoords(node.x, node.y);

            let color = this.DEFAULT_COLOR;
            let radius = DEFAULT_RADIUS;

            if (node.bookmarked) {
                color = BOOKMARK_COLOR;
                radius = BOOKMARK_RADIUS;
            } else if (node.type) {
                color = CHash(node.type);
                radius = SPECIAL_RADIUS;
            } else {
                color = DEFAULT_COLOR;
                radius = DEFAULT_RADIUS;
            }

            let nodeDiminish = 255 - (Math.pow(node.z - this.im.currentZ, 2));
            this.p.fill(color.r, color.g, color.b, nodeDiminish);
            this.p.ellipse(nodePos.x, nodePos.y, radius, radius);
        }

        // Draw edges
        for (let { v, w } of this.g.edges().map(({ v, w }) => {
            return { v: this.g.node(v), w: this.g.node(w) };
        })) {
            let nodePosU = this.transformCoords(v.x, v.y);
            let nodePosV = this.transformCoords(w.x, w.y);

            if (Math.abs(w.z - this.im.currentZ) > SELECTION_RADIUS_Z) {
                let diminishingFactor = (v.z + 1) / (this.im.currentZ + 1);
                // TODO: I'm exhausted but this is dumb, do better
                if (diminishingFactor > 1) {
                    diminishingFactor = 1 / diminishingFactor;
                }
                this.p.strokeWeight(EDGE_WIDTH * diminishingFactor);
                this.p.stroke(`rgba(0, 0, 0, ${diminishingFactor * .5})`);
            } else {
                this.p.strokeWeight(EDGE_WIDTH);
                this.p.stroke(this.EDGE_COLOR.r, this.EDGE_COLOR.g, this.EDGE_COLOR.b);
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

        // Draw centroids
        for (let node of this.g.nodes().map(n => this.g.node(n))) {
            let nodePos = this.transformCoords(node.x, node.y);
            let nodeDiminish = 255 - (Math.pow(node.z - this.im.currentZ, 2));
            if (nodeDiminish >= 254.5) {
                this.p.fill(CENTROID_COLOR.r, CENTROID_COLOR.g, CENTROID_COLOR.b, 255);
                this.p.ellipse(nodePos.x, nodePos.y, CENTROID_RADIUS, CENTROID_RADIUS);
            }
            if (node.lowConfidence) {
                this.p.fill(255, 255, 255, nodeDiminish);
                this.p.arc(nodePos.x, nodePos.y, 0.9 * CENTROID_RADIUS, 0.9 * CENTROID_RADIUS, Math.PI / 2, 3 * Math.PI / 2);
            }
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
