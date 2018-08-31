// @flow

import type { P5Type } from "colocorazon/types/p5";

import type ImageManager from "./ImageManager";


export default class Scrollbar {

    p: any;
    im: ImageManager;
    visible: boolean;

    left: number;
    top: number;
    width: number;
    height: number;


    constructor(opts: {
        p: P5Type,
        imageManager: ImageManager,
    }) {
        this.p = opts.p;
        this.im = opts.imageManager;

        this.left = 20;
        this.top = 30;
        this.height = this.p.height / 2;
        this.width = 20;
    }

    mouseClicked(): void {}
    mousePressed(): void {}

    draw(): void {
        this.p.rectMode(this.p.CORNER);
        this.p.noFill();
        this.p.stroke(255);
        this.p.strokeWeight(4);
        this.p.rect(this.left, this.top, this.width, this.height);
        this.p.fill(200);
        this.p.rect(this.left, this.top, this.width, this.height * (this.im.currentZ / (this.im.nSlices - 1)));
    }
}
