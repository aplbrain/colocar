// @flow

import uuidv4 from "uuid/v4";

import type { P5Type } from "../types/p5Types";
import type { Node } from "../types/colocardTypes";
import type ImageManager from "./ImageManager";

const ACTIVE_NODE_COLOR = { r: 255, g: 255, b: 0 };
const DEFAULT_COLOR = { r: 30, g: 240, b: 255 };

const SELECTION_THRESHOLD = 10;


export default class TraceManager {

    p: any;
    im: ImageManager;
    selectedNode: NodeMeta;
    nodes: Array<NodeMeta>;

    constructor(opts: {
        p: P5Type,
        imageManager: ImageManager
    }) {
        this.p = opts.p;
        this.im = opts.imageManager;

        this.nodes = [];
    }

    getNodes(): Array<NodeMeta> {
        return this.nodes;
    }

    addNode(newNodeId: string, newNode: NodeMeta): NodeMeta {
        // Verify that the node IDs line up
        newNode.id = newNodeId;
        this.nodes.push(newNode);
        return newNode;
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
                //!!!TEMP
                // TODO
                id: newNodeId
            });

            this.selectedNode = this.addNode(newNodeId, newNode);
        }
    }

    mousePressed(): void {
        if (this.p.mouseButton === this.p.RIGHT) {
            // Get the closest node and set it as active:
            // TODO: Filter in here
            let closeNodes = this.nodes
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
                this.selectedNode = n;
            }
        }
    }

    deleteActiveNode(): void {
        if (!this.selectedNode) { return; }
        if (this.selectedNode.protected) { return; }

        // Delete from nodesByLayer
        this.nodes = this.nodes.filter(node => node.id !== this.selectedNode.id);
        this.selectedNode = this.nodes.slice(-1)[0];
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
        this.p.noStroke();
        for (let j = 0; j < this.nodes.length; j++) {
            let diminishingFactor = Math.max(0, 180 - (Math.pow(this.nodes[j].z - this.im.currentZ, 2)));
            let color = DEFAULT_COLOR;
            this.p.fill(color.r, color.g, color.b, diminishingFactor);
            let transformedNode = this.transformCoords(this.nodes[j].x, this.nodes[j].y);
            this.p.ellipse(transformedNode.x, transformedNode.y, diminishingFactor/255 * 20, diminishingFactor/255 * 20);
        }

        // Draw the currently active node
        this.p.noStroke();
        if (this.selectedNode) {
            this.p.fill(
                ACTIVE_NODE_COLOR.r,
                ACTIVE_NODE_COLOR.g,
                ACTIVE_NODE_COLOR.b,
                180 - (Math.pow(this.selectedNode.z - this.im.currentZ, 2))
            );
            // TODO: Fade with depth
            let transformedNode = this.transformCoords(this.selectedNode.x, this.selectedNode.y);
            this.p.ellipse(transformedNode.x, transformedNode.y, 28, 28);
        }
    }

}

// Thin wrapper for node information.
class NodeMeta {
    id: string;
    x: number;
    y: number;
    z: number;
    created: ?number;

    constructor(opts: {
        x: number,
        y: number,
        z: number,
        created?: number,
        id?: string
    }) {
        this.x = opts.x;
        this.y = opts.y;
        this.z = opts.z;
        this.created = opts.created || Date.now();
        this.id = opts.id || uuidv4();
    }
}
