// @flow

import type { P5Type } from "colocorazon/dist/types/p5";
import type ImageManager from "./ImageManager";


export default class BorderHighlight {

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

    toggleVisibility() {
        this.visible = !this.visible;
    }

    draw(): void {
        if (this.visible && this.im.readiness[this.im.currentZ]) {
            this.p.noStroke();
            this.p.fill(192, 192, 192, 128);

            let highlightFrac = 0.05;
            let scaledWidth = this.im.imageWidth * this.im.scale;
            let scaledHeight = this.im.imageHeight * this.im.scale;
            let wallWidth = highlightFrac * scaledWidth;
            let wallHeight = highlightFrac * scaledHeight;

            let lowerX = this.im.position.x - scaledWidth / 2;
            let lowerY = this.im.position.y - scaledHeight / 2;

            // left
            this.p.rect(
                lowerX,
                lowerY,
                wallWidth,
                scaledHeight
            );
            // right
            this.p.rect(
                lowerX + scaledWidth - wallWidth,
                lowerY,
                wallWidth,
                scaledHeight
            );
            // top
            this.p.rect(
                lowerX + wallWidth,
                lowerY,
                scaledWidth - 2 * wallWidth,
                wallHeight
            );
            // bottom
            this.p.rect(
                lowerX + wallWidth,
                lowerY + scaledHeight - wallHeight,
                scaledWidth - 2 * wallWidth,
                wallHeight
            );
        }
    }
}
