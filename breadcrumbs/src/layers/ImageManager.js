// @flow

import type { P5Type, P5Image } from "colocorazon/dist/types/p5";
import Log from "colocorazon/dist/log";

let panIncrement: number = 50;
let scaleIncrement: number = .1;

export default class ImageManager {

    p: P5Type;
    batchSize: number;
    imageWidth: number;
    imageHeight: number;
    nSlices: number;
    images: Array<P5Image>;
    readiness: Array<boolean>;
    currentZ: number;
    scale: number;
    position: {x: number, y: number};

    // Expects an array of image URIs to be loaded
    constructor(opts: {p: P5Type, volume: Object, batchSize: number, startingZ?: number}): void {
        this.p = opts.p;
        this.scale = 1;
        panIncrement = Math.min(this.p.canvas.width, this.p.canvas.height) * .01;
        let centerPoint = this.getCenter();
        this.position = {x: centerPoint.x, y: centerPoint.y};
        this.batchSize = opts.batchSize;
        this.loadAllImages(opts.volume, opts.batchSize);
        this.readiness = new Array(this.nSlices);
        this.currentZ = opts.startingZ || Math.floor((this.nSlices) / 2); // Starts in the middle
    }

    // Loads in all the images.
    loadAllImages(volume: Object, batchSize: number): void {
        let xBounds = [volume.bounds[0][0], volume.bounds[1][0]];
        let yBounds = [volume.bounds[0][1], volume.bounds[1][1]];
        let zBounds = [volume.bounds[0][2], volume.bounds[1][2]];
        this.imageWidth = xBounds[1] - xBounds[0];
        this.imageHeight = yBounds[1] - yBounds[0];
        this.nSlices = zBounds[1] - zBounds[0];
        let nImages = Math.ceil(this.nSlices/batchSize);
        this.images = new Array(nImages);
        let xStr = `${xBounds[0]}:${xBounds[1]}`;
        let yStr = `${yBounds[0]}:${yBounds[1]}`;
        let endpointStr = "https://api.theboss.io/v1/cutout/";
        let metaStr = `${volume.collection}/${volume.experiment}/${volume.channel}/${volume.resolution}/`;
        for (let imageIx = 0; imageIx < nImages; imageIx++) {
            let zLower = zBounds[0] + batchSize*imageIx;
            let zUpper = Math.min(zLower + batchSize, zBounds[1]);
            let zStr = `${zLower}:${zUpper}`;
            let coordStr = `${xStr}/${yStr}/${zStr}`;
            let imageURI = endpointStr +
                metaStr +
                coordStr +
                "/?no-cache=true";
            this.images[imageIx] = this.p.loadImage(
                imageURI,
                () => {
                    let kLower = zLower - zBounds[0];
                    let kUpper = zUpper - zBounds[0];
                    for (let subIx = kLower; subIx < kUpper; subIx++) {
                        this.readiness[subIx] = true;
                    }
                },
                (err: Error) => {Log.error(err);},
                {
                    Authorization: `Bearer ${window.keycloak.token}`,
                    Accept: "image/jpeg"
                }
            );
        }
    }

    // Loads in all the images, working outwards from the center.
    // This hopes to load the images that the user is most likely to move to first, first.
    zigZagLoad(): void {
        let centerZ = Math.floor((this.nSlices) / 2);
        let maxDistance = Math.floor((this.nSlices) / 2);

        for (let i = 1; i <= maxDistance; i++) {
            // The next image moving down the z-axis
            let bottomIndexToLoad = centerZ - i;
            this.images[bottomIndexToLoad] = this.p.loadImage(
                this.images[bottomIndexToLoad],
                () => {
                    this.readiness[bottomIndexToLoad] = true;
                },
                (err: Error) => {Log.error(err);},
                {
                    Authorization: `Bearer ${window.keycloak.token}`
                }
            );

            // The next image moving up the z-axis.
            // Due to the rounding and 0-indexing, this executes one less time than the previous.
            let topIndexToLoad = centerZ + i;
            if (topIndexToLoad < this.nSlices) {
                this.images[topIndexToLoad] = this.p.loadImage(
                    this.images[topIndexToLoad],
                    () => {
                        this.readiness[topIndexToLoad] = true;
                    },
                    (err: Error) => {Log.error(err);},
                    {Authorization: `Bearer ${window.keycloak.token}`}
                );
            }
        }
    }

    setX(value: number): void {
        if (value >= 0 && value <= this.p.canvas.width) {
            this.position["x"] = value;
        } else {
            Log.error("Invalid position requested.");
        }
    }

    setY(value: number): void {
        if (value >= 0 && value <= this.p.canvas.height) {
            this.position["y"] = value;
        } else {
            Log.error("Invalid position requested.");
        }
    }

    setPosition(x: number, y: number): void {
        this.position["x"] = x;
        this.position["y"] = y;
    }

    setZ(index: number) {
        if (index % 1 === 0 && index >= 0 && index < this.nSlices) {
            this.currentZ = index;
        } else {
            Log.error("Invalid index requested.");
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
        return this.nSlices - 1;
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
    reset(z: ?number): void {
        this.setScale(1);
        let centerPoint = this.getCenter();
        this.setX(centerPoint.x);
        this.setY(centerPoint.y);
        if (z) {
            this.setZ(z);
        }
    }

    // Returns an object of the EDGES of the image.
    getBoundingRect(): {right: number, left: number, bottom: number, top: number } {
        // right vertical boundary
        let right = this.position.x + (this.imageWidth/2 * this.scale);
        // left vertical boundary
        let left = this.position.x - (this.imageWidth/2 * this.scale);
        // bottom horizontal boundary
        let bottom = this.position.y + (this.imageHeight/2 * this.scale);
        // top horizontal boundary
        let top = this.position.y - (this.imageHeight/2 * this.scale);
        return {
            right, left, bottom, top
        };
    }

    getCenter() {
        let centerX = this.p.windowWidth / 2;
        let centerY = this.p.windowHeight / 2;
        return {
            "x": centerX,
            "y": centerY
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

    draw(): void {
        if (this.readiness[this.currentZ]) {
            this.p.imageMode(this.p.CENTER);
            let imageIx = Math.floor(this.currentZ / this.batchSize);
            let subIx = this.currentZ % this.batchSize;
            this.p.image(
                this.images[imageIx],
                this.position.x,
                this.position.y,
                this.imageWidth * this.scale,
                this.imageHeight * this.scale,
                0,
                subIx*this.imageHeight,
                this.imageWidth,
                this.imageHeight,
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
