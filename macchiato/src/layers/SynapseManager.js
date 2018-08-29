// @flow

import type { P5Type } from "../types/p5Types";
import type ImageManager from "./ImageManager";

const DEFAULT_COLOR = { r: 90, g: 200, b: 90 }; // dark green
const MARKER_RADIUS = 30; // size of marker on screen


export default class SynapseManager {

    p: any;
    g: any;
    im: ImageManager;

    visibility: boolean;

    constructor(opts: {
        p: P5Type,
        imageManager: ImageManager,
    }) {
        this.p = opts.p;
        this.im = opts.imageManager;
        this.visibility = true;
    }

    toggleVisibility(): void {
        this.visibility = !this.visibility;
    }

    draw(): void {
        if (!this.visibility) {
            return;
        }

        this.p.noStroke();

        let color = DEFAULT_COLOR;
        this.p.fill(
            color.r, color.g, color.b,
        );
        this.p.ellipse(this.p.width / 2, this.p.height / 2, MARKER_RADIUS, MARKER_RADIUS);
    }
}
