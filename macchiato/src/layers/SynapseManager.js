// @flow

import type { P5Type } from "colocorazon/dist/types/p5";

import type ImageManager from "./ImageManager";

const DEFAULT_COLOR = { r: 90, g: 200, b: 90 }; // dark green
const CENTROID_COLOR = { r: 0, g: 0, b: 0 }; // dark black
const MARKER_RADIUS = 30; // size of marker on screen
const CENTROID_RADIUS = 12; // size of pupil


export default class SynapseManager {

    p: any;
    g: any;
    im: ImageManager;
    node: Object;
    zRadius: Number;

    visibility: boolean;

    constructor(opts: {
        p: P5Type,
        imageManager: ImageManager,
        node: Object,
        zRadius: Number
    }) {
        this.p = opts.p;
        this.im = opts.imageManager;
        this.node = opts.node;
        this.zRadius = opts.zRadius;
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
            200 - 20 * (Math.abs(this.node.coordinate[2] - (this.im.currentZ - this.zRadius)))
        );
        let {x, y} = this.transformCoords(
            this.node.coordinate[0],
            this.node.coordinate[1]
        );
        this.p.ellipse(x, y, MARKER_RADIUS);
        if (Math.abs(this.node.coordinate[2] - (this.im.currentZ - this.zRadius)) < 1) {
            this.p.fill(CENTROID_COLOR.r, CENTROID_COLOR.g, CENTROID_COLOR.b, 255);
            this.p.ellipse(x, y, CENTROID_RADIUS, CENTROID_RADIUS);
        }

    }
}
