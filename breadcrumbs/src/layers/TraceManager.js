// @flow

import * as graphlib from "graphlib";
import uuidv4 from "uuid/v4";

import type { P5Type } from "colocorazon/dist/types/p5";
import CHash from "colocorazon/dist/colorhash";


import type ImageManager from "./ImageManager";

const ACTIVE_NODE_COLOR = { r: 255, g: 255, b: 0 }; // yellow
const BOOKMARK_COLOR = { r: 255, g: 0, b: 255 }; // purple
const DEFAULT_COLOR = { r: 90, g: 200, b: 90 }; // dark green
const EDGE_COLOR = { r: 60, g: 170, b: 60 }; // dark green
const CENTROID_COLOR = { r: 0, g: 0, b: 0 }; // dark black

// Radius of a marker when it has a node.type
const SPECIAL_RADIUS = 25;
// Radius of a marker for a node that is marked as a bookmark
const BOOKMARK_RADIUS = 25;
// Radius of the default marker for a neuron
const DEFAULT_RADIUS = 7;
// Radius of centroid marker
const CENTROID_RADIUS = 12;

// Distance in pixels outside of which a node is not selectable
const SELECTION_THRESHOLD = 15;
// Number of z-slices after which a node is no longer selectable
const SELECTION_RADIUS_Z = 20;

window.CHash = CHash;

export default class TraceManager {

    p: any;
    g: any;
    im: ImageManager;
    activeNode: NodeMeta;
    _allowDisconnected: boolean;

    drawHinting: boolean;
    visibility: boolean;
    newSubgraph: boolean;

    constructor(opts: {
        p: P5Type,
        imageManager: ImageManager,
        startingGraph: Object,
        allowDisconnected: boolean
    }) {
        this.p = opts.p;
        this.im = opts.imageManager;
        this.g = new graphlib.Graph({
            directed: true
        });

        window.tm = this;
        this.drawHinting = false;
        this.visibility = true;
        this._allowDisconnected = opts.allowDisconnected || true;
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

    getEntitiesForScrollbar() {
        return this.g.nodes().map(i => this.g.node(i)).concat({ ...this.activeNode, active: true });
    }

    stopHinting(): void {
        this.drawHinting = false;
    }

    toggleVisibility(): void {
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
                this.activeNode = n;
            }
        } else {
            this.drawHinting = true;
        }
    }

    insertCachedGraph(graph: Object, activeNodeId: string) {
        this.g = graph;
        this.activeNode = this.g.node(activeNodeId);
    }

    insertDownloadedGraph(graph: Object, activeNodeId: string) {
        this.g = graph;
        // assign active node arbitrarily if missing
        if (!activeNodeId) {
            activeNodeId = this.g.nodes()[0];
        }
        this.activeNode = this.g.node(activeNodeId);
        // set type to "initial" if single node
        if (this.g.nodeCount() === 1) {
            let nodeId = this.g.nodes()[0];
            let node = this.g.node(nodeId);
            node.type = "initial";
            this.g.setNode(nodeId, node);
        }
        // protect downloaded graph
        let nodeIds = this.g.nodes();
        nodeIds.forEach(nodeId => {
            let node = this.g.node(nodeId);
            node.protected = true;
            this.g.setNode(nodeId, node);
        });
    }

    extendGraph(newNode: NodeMeta): void {
        if (this.activeNode) {
            this.g.setNode(newNode.id, newNode);

            // Create an edge from the active node.
            let newEdge = {
                v: this.activeNode.id,
                w: newNode.id
            };
            this.g.setEdge(newEdge);
            this.activeNode = newNode;
        } else if (this._allowDisconnected) {
            this.g.setNode(newNode.id, newNode);
            this.activeNode = newNode;
        }
    }

    mouseClicked(): void {
        if (this.im.imageCollision(this.p.mouseX, this.p.mouseY)) {

            let newNodeId = uuidv4();

            // Normalize relative to the original image.
            let x = (this.p.mouseX - this.im.position.x) / this.im.scale;
            let y = (this.p.mouseY - this.im.position.y) / this.im.scale;

            // TODO: Project xyz into DATA space, not p5 space
            let newNode = new NodeMeta({
                x,
                y,
                z: this.im.currentZ,
                id: newNodeId
            });

            this.extendGraph(newNode);
        }

        this.drawHinting = false;
    }

    markLowConfidence(): void {
        let node = this.g.node(this.activeNode.id);
        if (!node.protected) {
            node.lowConfidence = !node.lowConfidence;
            this.g.setNode(this.activeNode.id, node);
        }
    }

    markNodeType(nodeType: string): void {
        let node = this.g.node(this.activeNode.id);
        if (!node.protected) {
            if (node.type === nodeType) {
                node.type = undefined;
            } else {
                node.type = nodeType;
            }
            this.g.setNode(this.activeNode.id, node);
        }
    }

    markBookmark(): void {
        if (this.g.node(this.activeNode.id).bookmarked) {
            this.g.node(this.activeNode.id).bookmarked = false;
        } else {
            this.g.node(this.activeNode.id).bookmarked = true;
        }
    }

    popBookmark(): { x: number, y: number, z: number } {
        let nodes = this.g.nodes().map(nodeId => this.g.node(nodeId));
        let bmarks = nodes.reverse().filter(n => n.bookmarked);
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

        if (!this.g.isLeaf(this.activeNode.id)) {
            return;
        }

        let replacementId = this.g.neighbors(this.activeNode.id)[0];
        let replacement = this.g.node(replacementId);
        this.g.removeNode(this.activeNode.id);
        this.activeNode = replacement;
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
            if (node.lowConfidence) {
                this.p.fill(255, 255, 255, nodeDiminish);
                this.p.arc(nodePos.x, nodePos.y, 0.9 * radius, 0.9 * radius, Math.PI / 2, 3 * Math.PI / 2);
            }
        }

        // Draw edges
        for (let { v, w } of this.g.edges().map(({ v, w }) => {
            return { v: this.g.node(v), w: this.g.node(w) };
        })) {
            let nodePosU = this.transformCoords(v.x, v.y);
            let nodePosV = this.transformCoords(w.x, w.y);

            if (Math.abs(w.z - this.im.currentZ) > SELECTION_RADIUS_Z) {
                let edgeDiminish = (v.z + 1) / (this.im.currentZ + 1);
                // TODO: I'm exhausted but this is dumb, do better
                if (edgeDiminish > 1) {
                    edgeDiminish = 1 / edgeDiminish;
                }
                this.p.strokeWeight(3 * edgeDiminish);
                this.p.stroke(`rgba(0, 0, 0, ${edgeDiminish * .5})`);
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

        // Draw centroids
        for (let node of this.g.nodes().map(n => this.g.node(n))) {
            let nodePos = this.transformCoords(node.x, node.y);
            let nodeDiminish = 255 - (Math.pow(node.z - this.im.currentZ, 2));
            if (nodeDiminish >= 254.5) {
                this.p.fill(CENTROID_COLOR.r, CENTROID_COLOR.g, CENTROID_COLOR.b, 255);
                this.p.ellipse(nodePos.x, nodePos.y, CENTROID_RADIUS, CENTROID_RADIUS);
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
    lowConfidence: ?boolean;
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
        lowConfidence?: boolean,
        type?: string,
        id?: string
    }) {
        this.x = opts.x;
        this.y = opts.y;
        this.z = opts.z;
        this.author = opts.author || undefined;
        this.lowConfidence = opts.lowConfidence || false;
        this.type = opts.type || undefined;
        this.created = opts.created || new Date();
        this.id = opts.id || uuidv4();
    }
}
