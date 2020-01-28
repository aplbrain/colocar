// @flow

import type { P5Type } from "colocorazon/dist/types/p5";

import CHash from "colocorazon/dist/colorhash";

import type ImageManager from "./ImageManager";
import type TraceManager from "./TraceManager";

const HIGHLIGHT_OFFSET_AMOUNT = 5;
const HIGHLIGHT_COLOR = [255, 50, 100];
const DEFAULT_COLOR = [255, 255, 0, 200];

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

    mouseClicked(): boolean {

    }
    mousePressed(): void {
        if (this.p.mouseButton === this.p.RIGHT) {
            if (this.p.mouseX < this.left + this.width && this.p.mouseY < this.top + this.height) {
                this.im.setZ(Math.round(this.im.nSlices * (this.p.mouseY - this.top) / (this.height - this.top)));
                return false;
            }
        }
        return true;
    }

    getEntities() {
        return (this.tm.g.nodes().map(i => this.tm.g.node(i)).map(i => {
            let c = [150, 200, 50];
            let offset = 0;
            if (i.bookmarked) {
                c = HIGHLIGHT_COLOR;
                offset = HIGHLIGHT_OFFSET_AMOUNT;
            }
            else if (i.type) {
                let h = CHash(i.type);
                c = [h.r, h.g, h.b];
            }
            return {
                z: i.z,
                color: c,
                offset,
            };
        }).concat((this.tm.activeNode ? [{
            z: this.tm.activeNode.z,
            color: DEFAULT_COLOR,
            offset: HIGHLIGHT_OFFSET_AMOUNT
        }] : [])));
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
                this.width + this.left + e.offset,
                _z
            );
        });

        // Draw thumb:
        this.p.stroke(200);
        this.p.line(
            this.left - HIGHLIGHT_OFFSET_AMOUNT, this.top + this.height * (this.im.currentZ / this.im.nSlices),
            this.left + this.width, this.top + this.height * (this.im.currentZ / this.im.nSlices)
        );
    }
}
