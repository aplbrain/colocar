// @flow

import type { P5Type, P5Image } from "../types/p5Types";

let panIncrement: number = 50;
let scaleIncrement: number = .1;

export default class ImageManager {

    p: P5Type;
    imageURIs: Array<string>;
    images: Array<P5Image>;
    readiness: Array<boolean>;
    currentZ: number;
    scale: number;
    position: {x: number, y: number};

    // Expects an array of image URIs to be loaded
    constructor(opts: {p: P5Type, imageURIs: Array<string>}): void {
        this.p = opts.p;
        this.scale = 1;
        this.position = {x: this.p.canvas.width / 2, y: this.p.canvas.height / 2};
        panIncrement = Math.min(this.p.canvas.width, this.p.canvas.height) * .01;

        this.imageURIs = opts.imageURIs;
        this.images = new Array(this.imageURIs.length);
        this.readiness = new Array(this.imageURIs.length);
        this.currentZ = Math.floor((this.imageURIs.length) / 2); // Starts in the middle

        // Load the middle image first
        this.images[this.currentZ] = this.p.loadImage(
            this.imageURIs[this.currentZ],
            () => {
                this.readiness[this.currentZ] = true;
            },
            (err: Error) => {console.error(err);},
            {
                Authorization: `Bearer ${window.keycloak.token}`
            }
        );

        this.loadAllImages();
    }

    // Loads in all the images.
    loadAllImages(): void {
        for (let i = 0; i < this.imageURIs.length; i++) {
            this.images[i] = this.p.loadImage(
                this.imageURIs[i],
                () => {
                    this.readiness[i] = true;
                },
                (err: Error) => {console.error(err);},
                {
                    Authorization: `Bearer ${window.keycloak.token}`
                }
            );
        }
    }

    // Loads in all the images, working outwards from the center.
    // This hopes to load the images that the user is most likely to move to first, first.
    zigZagLoad(): void {
        let centerZ = Math.floor((this.imageURIs.length) / 2);
        let maxDistance = Math.floor((this.imageURIs.length) / 2);

        for (let i = 1; i <= maxDistance; i++) {
            // The next image moving down the z-axis
            let bottomIndexToLoad = centerZ - i;
            this.images[bottomIndexToLoad] = this.p.loadImage(
                this.imageURIs[bottomIndexToLoad],
                () => {
                    this.readiness[bottomIndexToLoad] = true;
                },
                (err: Error) => {console.error(err);},
                {
                    Authorization: `Bearer ${window.keycloak.token}`
                }
            );

            // The next image moving up the z-axis.
            // Due to the rounding and 0-indexing, this executes one less time than the previous.
            let topIndexToLoad = centerZ + i;
            if (topIndexToLoad < this.imageURIs.length) {
                this.images[topIndexToLoad] = this.p.loadImage(
                    this.imageURIs[topIndexToLoad],
                    () => {
                        this.readiness[topIndexToLoad] = true;
                    },
                    (err: Error) => {console.error(err);},
                    {Authorization: `Bearer ${window.keycloak.token}`}
                );
            }
        }
    }

    setX(value: number): void {
        if (value >= 0 && value <= this.p.canvas.width) {
            this.position["x"] = value;
        } else {
            console.error("Invalid position requested.");
        }
    }

    setY(value: number): void {
        if (value >= 0 && value <= this.p.canvas.height) {
            this.position["y"] = value;
        } else {
            console.error("Invalid position requested.");
        }
    }

    setPosition(x: number, y: number): void {
        this.position["x"] = x;
        this.position["y"] = y;
    }

    setZ(index: number) {
        if (index % 1 === 0 && index >= 0 && index < this.images.length) {
            this.currentZ = index;
        } else {
            console.error("Invalid index requested.");
        }
    }

    panUp(): void {
        this.position["y"] -= panIncrement;
        if (this.position["y"] < 0) {
            this.position["y"] = 0;
        }
    }

    panDown(): void {
        this.position["y"] += panIncrement;
        if (this.position["y"] > this.p.canvas.height) {
            this.position["y"] = this.p.canvas.height;
        }
    }

    panLeft(): void {
        this.position["x"] -= panIncrement;
        if (this.position["x"] < 0) {
            this.position["x"] = 0;
        }
    }

    panRight(): void {
        this.position["x"] += panIncrement;
        if (this.position["x"] > this.p.canvas.width) {
            this.position["x"] = this.p.canvas.width;
        }
    }

    maxZ(): number {
        return this.images.length - 1;
    }

    incrementZ(): void {
        if (this.currentZ < this.maxZ()) {
            this.currentZ++;
        }
    }

    decrementZ(): void {
        if (this.currentZ > 0) {
            this.currentZ--;
        }
    }

    scaleUp(): void {
        this.scale += scaleIncrement;
        // if (this.scale > /* some reasonable limit */) {
        //     this.scale = scaleIncrement;
        // }
    }

    scaleDown(): void {
        if (this.scale - scaleIncrement < scaleIncrement) {
            this.scale = scaleIncrement;
        } else {
            this.scale -= scaleIncrement;
        }
    }

    setScale(scale: number) {
        if (scale > 0) {
            this.scale = scale;
        }
    }

    // Resets to "default" scale and position.
    // Stays the same image slice.
    reset(): void {
        this.setScale(1);
        this.setX(this.p.canvas.width/2);
        this.setY(this.p.canvas.height/2);
    }

    // Returns an object of the EDGES of the image.
    getBoundingRect(): {right: number, left: number, bottom: number, top: number } {
        // right vertical boundary
        let right = this.position.x + (this.images[this.currentZ].width/2 * this.scale);
        // left vertical boundary
        let left = this.position.x - (this.images[this.currentZ].width/2 * this.scale);
        // bottom horizontal boundary
        let bottom = this.position.y + (this.images[this.currentZ].height/2 * this.scale);
        // top horizontal boundary
        let top = this.position.y - (this.images[this.currentZ].height/2 * this.scale);
        return {
            right, left, bottom, top
        };
    }

    // Checks if a point (usually mouse position) is inside the image.
    imageCollision(x: number, y: number) {
        let bounding = this.getBoundingRect();

        if (x > bounding.right || x < bounding.left) {
            return false;
        }

        if (y > bounding.bottom || y < bounding.top) {
            return false;
        }

        return true;
    }

    getCurrentImage(): P5Image {
        return this.images[this.currentZ];
    }

    draw(): void {
        if (this.readiness[this.currentZ]) {
            this.p.imageMode(this.p.CENTER);
            this.p.image(this.images[this.currentZ],
                this.position.x,
                this.position.y,
                this.images[this.currentZ].width * this.scale,
                this.images[this.currentZ].height * this.scale,
            );
        } else {
            // Image not loaded yet. Filler image.
            this.p.stroke(255, 0, 0);
            this.p.fill(255);

            this.p.rectMode(this.p.CENTER);
            this.p.rect(
                this.position.x,
                this.position.y,
                500 * this.scale,
                500 * this.scale,
            );

            let offset = 250 * this.scale;
            this.p.line(this.position.x + offset, this.position.y + offset, this.position.x - offset, this.position.y - offset);
            this.p.line(this.position.x - offset, this.position.y + offset, this.position.x + offset, this.position.y - offset);

            this.p.fill(0);
            this.p.noStroke();
            this.p.strokeWeight(4);
            this.p.textSize(24);
            this.p.textAlign(this.p.CENTER, this.p.CENTER);
            this.p.text("Loading...", this.position.x, this.position.y);
        }
    }
}