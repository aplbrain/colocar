// @flow

import type { P5Type, P5Image } from "../types/p5";


type BossDBParams = {
    p: P5Type,
    bossURI: string,
    center: { x: number, y: number, z: number },
    range: {
        x: [number, number],
        y: [number, number],
        z: [number, number]
    },
    res: number,

    shouldPreload?: boolean,
    shouldCache?: boolean,
};


export default class BossDB {

    img: P5Image;
    ready: boolean;
    p: P5Type;
    bossURI: string;
    center: { x: number, y: number, z: number };
    range: {
        x: [number, number],
        y: [number, number],
        z: [number, number]
    };
    res: number;

    currentZ: number;

    _shouldPreload: boolean;
    _shouldCache: boolean;
    _cache: { [number]: P5Image };

    constructor(opts: BossDBParams) {
        let self = this;
        self.ready = false;
        self.p = opts.p;
        self.bossURI = opts.bossURI;
        self.center = opts.center;
        self.range = opts.range;
        self.res = opts.res;

        self.currentZ = self.center.z;

        self._shouldPreload = opts.shouldPreload || true;
        self._shouldCache = opts.shouldCache || true;
        self._cache = {};

        self.setImage(self.currentZ);

    }

    setImage(z: number) {
        let self = this;
        self.currentZ = z;

        let url = (
            `https://api.theboss.io/v1/image/` +
            self.bossURI +
            `xy/${self.res}/`
        );

        if (self._cache[z]) {
            self.img = self._cache[z];
        } else {
            let slug = (
                `${self.range.x[0]}:${self.range.x[1]}/` +
                `${self.range.y[0]}:${self.range.y[1]}/` +
                `${z}/`
            );
            this.img = self.p.loadImage(
                url + slug,
                () => { self.ready = true; },
                (err: Object) => { console.error(err); },
                {
                    Authorization: `Bearer ${window.keycloak.token}`
                }
            );
        }

        if (self._shouldCache) {
            self._cache[z] = self.img;
        }


        if (self._shouldPreload) {
            let slug = (
                `${self.range.x[0]}:${self.range.x[1]}/` +
                `${self.range.y[0]}:${self.range.y[1]}/` +
                `${z-1}/`
            );
            if (!this._cache[z - 1]) {
                this._cache[z - 1] = self.p.loadImage(
                    url + slug,
                    () => { },
                    (err) => { console.error(err); },
                    {
                        Authorization: `Bearer ${window.keycloak.token}`
                    }
                );
            }
            slug = (
                `${self.range.x[0]}:${self.range.x[1]}/` +
                `${self.range.y[0]}:${self.range.y[1]}/` +
                `${z + 1}/`
            );
            if (!this._cache[z + 1]) {
                this._cache[z + 1] = self.p.loadImage(
                    url + slug,
                    () => { },
                    (err) => { console.error(err); },
                    {
                        Authorization: `Bearer ${window.keycloak.token}`
                    }
                );
            }
        }
    }

    zUp(): void {
        this.setImage(this.currentZ + 1);
    }

    zDown(): void {
        this.setImage(this.currentZ - 1);
    }


    draw() {
        if (this.ready) {
            this.p.image(
                this.img,
                0, 0,
                this.p.width, this.p.height
            );
            // Draw a line on the left side of the screen to indicate progress
            // through the block.
            let progress = this.p.height * (
                (this.currentZ - this.range.z[0]) /
                (this.range.z[1] - this.range.z[0])
            );
            this.p.line(0, progress, 10, progress);
        }
    }
}
