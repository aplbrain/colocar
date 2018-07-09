// @flow

import type {
    P5Type
} from "../types/p5Types";
import type ImageManager from "./ImageManager";


export default class Scrollbar {

    p: any;
    im: ImageManager;
    visible: boolean;

    constructor(opts: {
        p: P5Type,
        imageManager: ImageManager
    }) {
        this.p = opts.p;
        this.im = opts.imageManager;
    }

    mouseClicked(): void {}
    mousePressed(): void {}

    draw(): void {
        this.p.rectMode(this.p.CORNER);
        this.p.noFill();
        this.p.stroke(255);
        this.p.strokeWeight(4);
        this.p.rect(20, 30, 20, this.p.height/2);
        this.p.fill(200);
        this.p.rect(20, 30, 20, this.p.height/2 * (this.im.currentZ / this.im.imageURIs.length));
    }
}
