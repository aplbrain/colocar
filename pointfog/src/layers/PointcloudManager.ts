

import uuidv4 from "uuid/v4";

// import { P5Type } from "colocorazon/dist/types/p5";
type P5Type = any;


import ImageManager from "./ImageManager";

// Highlight color for active node
const ACTIVE_NODE_COLOR = { r: 255, g: 255, b: 0 };
// Default node color
const DEFAULT_COLOR = { r: 30, g: 240, b: 255 };
const CENTROID_COLOR = { r: 190, g: 10, b: 10 };
const BOOKMARKED_COLOR = { r: 255, g: 10, b: 150 };

// Distance in pixels inside of which a node can be selected
const SELECTION_THRESHOLD = 10;
// Distance in z-slices inside of which a node can be selected
const SELECTION_RADIUS_Z = 10;
const DIMINISH_RATE = 3.;


export default class TraceManager {


    p: P5Type;
    im: ImageManager;
    visible: boolean;
    selectedNode: NodeMeta;
    nodes: Array<NodeMeta>;

    constructor(opts: {
        p: any;
        imageManager: ImageManager;
    }) {
        this.p = opts.p;
        this.im = opts.imageManager;
        this.visible = true;

        this.nodes = [];
    }

    getNodes(): Array<NodeMeta> {
        return this.nodes;
    }

    getEntitiesForScrollbar() {
        return this.getNodes();
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
            let x = (this.p.mouseX - this.im.position.x) / this.im.scale;
            let y = (this.p.mouseY - this.im.position.y) / this.im.scale;

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
            let closeNodes = this.nodes.filter(n => Math.abs(n.z - this.im.currentZ) < SELECTION_RADIUS_Z).filter(n => {
                n = this.transformCoords(n.x, n.y);
                return Math.sqrt(Math.pow(this.p.mouseX - n.x, 2) + Math.pow(this.p.mouseY - n.y, 2)) < SELECTION_THRESHOLD;
            });
            closeNodes.sort((n, m) => {
                n = this.transformCoords(n.x, n.y);
                m = this.transformCoords(m.x, m.y);
                let ndist = Math.pow(this.p.mouseX - n.x, 2) + Math.pow(this.p.mouseY - n.y, 2);
                let mdist = Math.pow(this.p.mouseX - m.x, 2) + Math.pow(this.p.mouseY - m.y, 2);
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

    markLowConfidence(): void {
        let node = this.selectedNode;
        if (node && !node.protected) {
            node.lowConfidence = !node.lowConfidence;
        }
    }


    markBookmark(): void {
        if (this.selectedNode.bookmarked) {
            this.selectedNode.bookmarked = false;
        } else {
            this.selectedNode.bookmarked = true;
        }
    }

    popBookmark(): { x: number; y: number; z: number; } {
        let bmarks = this.nodes.reverse().filter(n => n.bookmarked);
        if (!bmarks.length) {
            // If you have set no bookmarks, return current XYZ
            return {
                x: this.activeNode.x,
                y: this.activeNode.y,
                z: this.activeNode.z
            };
        } else {
            return {
                x: bmarks[0].x,
                y: bmarks[0].y,
                z: bmarks[0].z
            };
        }
    }

    deleteActiveNode(): void {
        if (!this.selectedNode) { return; }
        if (this.selectedNode.protected) { return; }

        // Delete from nodesByLayer
        this.nodes = this.nodes.filter(node => node.id !== this.selectedNode.id);
        this.selectedNode = null;
    }

    toggleVisibility(): void {
        this.visible = !this.visible;
    }

    // Denormalize the node to scale it to the correct position.
    // Returns SCREEN position
    transformCoords(x: number, y: number) {
        return {
            x: x * this.im.scale + this.im.position.x,
            y: y * this.im.scale + this.im.position.y
        };
    }

    // Screen to IMAGE position
    normalizeCoords(x: number, y: number) {
        return {
            x: (x - this.im.position.x) / this.im.scale,
            y: (y - this.im.position.y) / this.im.scale
        };
    }

    draw(): void {
        if (this.visible) {
            this.p.noStroke();
            for (let j = 0; j < this.nodes.length; j++) {
                let node = this.nodes[j];
                let diminishingFactor = Math.max(0, 180 - DIMINISH_RATE * Math.pow(node.z - this.im.currentZ, 2));
                let color = DEFAULT_COLOR;
                if (node.bookmarked) {
                    color = BOOKMARKED_COLOR;
                }
                let transformedNode = this.transformCoords(node.x, node.y);
                transformedNode.lowConfidence = node.lowConfidence;
                this.p.fill(color.r, color.g, color.b, diminishingFactor);
                this.p.ellipse(transformedNode.x, transformedNode.y, diminishingFactor / 255 * 20, diminishingFactor / 255 * 20);
                if (transformedNode.lowConfidence) {
                    this.p.fill(255, 255, 255, diminishingFactor);
                    this.p.arc(transformedNode.x, transformedNode.y, 0.9 * diminishingFactor / 255 * 20, 0.9 * diminishingFactor / 255 * 20, Math.PI / 2, 3 * Math.PI / 2);
                }
                if (Math.abs(diminishingFactor) >= 179.5) {
                    this.p.fill(CENTROID_COLOR.r, CENTROID_COLOR.g, CENTROID_COLOR.b, 255);
                    this.p.ellipse(transformedNode.x, transformedNode.y, 6, 6);
                }
            }

            // Draw the currently active node
            this.p.noStroke();
            if (this.selectedNode) {
                this.p.fill(ACTIVE_NODE_COLOR.r, ACTIVE_NODE_COLOR.g, ACTIVE_NODE_COLOR.b, 180 - DIMINISH_RATE * Math.pow(this.selectedNode.z - this.im.currentZ, 2));
                let transformedNode = this.transformCoords(this.selectedNode.x, this.selectedNode.y);
                this.p.ellipse(transformedNode.x, transformedNode.y, 28, 28);
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
    lowConfidence: boolean | null | undefined;
    created: number | null | undefined;

    constructor(opts: {
        x: number;
        y: number;
        z: number;
        created?: number;
        lowConfidence?: boolean;
        id?: string;
    }) {
        this.x = opts.x;
        this.y = opts.y;
        this.z = opts.z;
        this.lowConfidence = opts.lowConfidence || false;
        this.created = opts.created || Date.now();
        this.id = opts.id || uuidv4();
    }
}