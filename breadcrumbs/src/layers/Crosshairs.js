// @flow
import type { P5Type } from "../types/p5";


export default class Crosshairs {

    p: P5Type;
    margin: number;
    visible: boolean;

    constructor(opts: { p: P5Type, margin?: number }) {
        this.p = opts.p;
        this.margin = opts.margin || 10;
        this.visible = true;
    }

    draw(): void {
        /*
        Draw the crosshairs.

        Arguments:
            p: The p5 instance in which to draw

        Returns:
            None
        */
        if (!this.visible) { return; }

        let p = this.p;

        // Set the stroke:
        p.strokeWeight(2);
        p.stroke(0, 255, 255, 100);

        // Draw the lines, modulo the margins.
        // 12:00
        p.line(
            p.width / 2, 0,
            p.width / 2, p.height / 2 - this.margin
        );
        // 9:00
        p.line(
            0, p.height / 2,
            p.width / 2 - this.margin, p.height / 2
        );
        // 6:00
        p.line(
            p.width / 2, p.height,
            p.width / 2, p.height / 2 + this.margin
        );
        // 3:00
        p.line(
            p.width / 2 + this.margin, p.height / 2,
            p.width, p.height / 2
        );
    }

    toggleVisibility(visible?: boolean): void {
        this.visible = !this.visible;
    }
}
