// @flow

import type { P5Type } from "../types/p5Types";
import type ImageManager from "./ImageManager";


export default class TraceManager {

    p: any;
    im: ImageManager;
    visible: boolean;

    constructor(opts: {
        p: P5Type,
        imageManager: ImageManager
    }) {
        this.p = opts.p;
        this.im = opts.imageManager;
        this.visible = true;
    }

    mouseClicked(): void {}
    mousePressed(): void {}

    // Denormalize the node to scale it to the correct position.
    // Returns SCREEN position
    transformCoords(x: number, y: number) {
        return {
            x: (x * this.im.scale) + this.im.position.x,
            y: (y * this.im.scale) + this.im.position.y,
        };
    }

    toggleVisibility(): void {
        this.visible = !this.visible;
    }

    draw(): void {
        if (!this.visible) {
            return;
        }
        this.p.stroke(255, 150, 0, 230);
        this.p.strokeWeight(1);
        this.p.line(this.im.position.x, -10e5, this.im.position.x, 10e5);
        this.p.line(10e5, this.im.position.y, -10e5, this.im.position.y);
    }
}
