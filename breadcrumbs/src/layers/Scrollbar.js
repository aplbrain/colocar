// @flow

import type { P5Type } from "colocorazon/dist/types/p5Types";
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
        pointcloudManager: PointcloudManager
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
                color: [0, 150, 200, 40]
            };
        });
    }

    rescaleZ(oldZ: number): number {
        let nSlots = this.im.nSlices-1;
        let newZ = this.top + (this.height * (oldZ / nSlots));
        return newZ;
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
            let _z = this.rescaleZ(e.z);
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
            this.left, this.rescaleZ(this.im.currentZ),
            this.left + this.width, this.rescaleZ(this.im.currentZ)
        );
    }
}
