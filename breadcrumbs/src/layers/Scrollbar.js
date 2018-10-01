// @flow

import type { P5Type } from "colocorazon/dist/types/p5";

import CHash from "colocorazon/dist/colorhash";

import type ImageManager from "./ImageManager";
import type TraceManager from "./TraceManager";


export default class Scrollbar {

    p: any;
    im: ImageManager;
    tm: TraceManager;
    visible: boolean;

    left: number;
    top: number;
    width: number;
    height: number;


    constructor(opts: {
        p: P5Type,
        imageManager: ImageManager,
        traceManager: TraceManager
    }) {
        this.p = opts.p;
        this.im = opts.imageManager;
        this.tm = opts.traceManager;

        this.left = 20;
        this.top = 30;
        this.height = this.p.height / 2;
        this.width = 20;
    }

    mouseClicked(): void {}
    mousePressed(): void {}

    getEntities() {
        return (this.tm.g.nodes().map(i => this.tm.g.node(i)).map(i => {
            let c = [150, 200, 50];
            if (i.type) {
                let h = CHash(i.type);
                c = [h.r, h.g, h.b];
            }
            return {
                z: i.z,
                color: c
            };
        }).concat((this.tm.activeNode ? [{
            z: this.tm.activeNode.z,
            color: [255, 255, 0, 200]
        }]: [])));
    }

    draw(): void {
        this.p.rectMode(this.p.CORNER);
        // Draw scrollbar:
        this.p.fill(100);
        this.p.stroke(100);
        this.p.strokeWeight(4);
        this.p.rect(this.left, this.top, this.width, this.height);

        // Draw entities:
        this.getEntities().forEach(e => {
            this.p.stroke(...e.color);
            let _z = this.top + (this.height * (e.z / this.im.nSlices));
            this.p.line(
                this.left,
                _z,
                this.width + this.left,
                _z
            );
        });

        // Draw thumb:
        this.p.stroke(200);
        this.p.line(
            this.left, this.top + this.height * (this.im.currentZ / this.im.nSlices),
            this.left + this.width, this.top + this.height * (this.im.currentZ / this.im.nSlices)
        );
    }
}
