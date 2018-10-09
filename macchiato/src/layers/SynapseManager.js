// @flow

import type { P5Type } from "colocorazon/dist/types/p5";

import type ImageManager from "./ImageManager";

const DEFAULT_COLOR = { r: 90, g: 200, b: 90 }; // dark green
const MARKER_RADIUS = 30; // size of marker on screen


export default class SynapseManager {

    p: any;
    g: any;
    im: ImageManager;
    node: Object;

    visibility: boolean;

    constructor(opts: {
        p: P5Type,
        imageManager: ImageManager,
        node: Object
    }) {
        this.p = opts.p;
        this.im = opts.imageManager;
        this.node = opts.node;
        this.visibility = true;
    }

    toggleVisibility(): void {
        this.visibility = !this.visibility;
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

        let color = DEFAULT_COLOR;
        this.p.fill(
            color.r, color.g, color.b,
            200 - 20 * (Math.abs(this.node.coordinate[2] - (this.im.currentZ-10)))
        );
        let {x, y} = this.transformCoords(
            this.node.coordinate[0],
            this.node.coordinate[1]
        );
        this.p.ellipse(x, y, MARKER_RADIUS);
    }
}
