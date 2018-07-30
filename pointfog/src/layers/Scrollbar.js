// @flow

import type {
    P5Type
} from "../types/p5Types";
import type ImageManager from "./ImageManager";
import type PointcloudManager from "./PointcloudManager";


export default class Scrollbar {

    p: any;
    im: ImageManager;
    pm: PointcloudManager;
    visible: boolean;

    left: number;
    top: number;
    width: number;
    height: number;


    constructor(opts: {
        p: P5Type,
        imageManager: ImageManager,
        pointcloudManager: pointcloudManager
    }) {
        this.p = opts.p;
        this.im = opts.imageManager;
        this.pm = opts.pointcloudManager;

        this.left = 20;
        this.top = 30;
        this.height = this.p.height / 2;
        this.width = 20;
    }

    mouseClicked(): void {}
    mousePressed(): void {}

    getEntities() {
        return this.pm.nodes.map(i => {
            return {
                z: i.z,
                color: [0, 255, 255]
            };
        });
    }

    draw(): void {
        this.p.rectMode(this.p.CORNER);
        this.p.noFill();
        this.p.stroke(255);
        this.p.strokeWeight(4);
        this.p.rect(this.left, this.top, this.width, this.height);
        this.p.fill(200);
        this.p.rect(this.left, this.top, this.width, this.height * (this.im.currentZ / this.im.nSlices));
        this.getEntities().forEach(e => {
            this.p.stroke(...e.color, 50);
            let _z = this.top + (this.height * (e.z / this.im.nSlices));
            this.p.line(
                this.left,
                _z,
                this.width + this.left,
                _z
            );
        });
    }
}
