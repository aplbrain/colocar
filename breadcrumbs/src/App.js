// @flow

import React, { Component } from 'react';
import './App.css';

import BossDB from "./layers/BossDB";
import Crosshairs from "./layers/Crosshairs";
import Trace from "./layers/Trace";

import P5Type from "./types/p5";

// import p5 from 'p5';

let p5 = window.p5;

p5.prototype.loadImage = function (path, successCallback, failureCallback, headers) {
    p5._validateParameters('loadImage', arguments);
    var img = new Image();
    var pImg = new p5.Image(1, 1, this);

    var self = this;

    let URL = window.URL || window.webkitURL;
    headers = headers || {};

    fetch(path, {
        headers,
    }).then(res => {
        if (res.ok) {
            res.blob().then(b => {
                // Start loading the image:
                img.src = URL.createObjectURL(b);
            })
        } else {
            console.error(res);
        }
    });

    img.onload = function () {
        pImg.width = pImg.canvas.width = img.width;
        pImg.height = pImg.canvas.height = img.height;

        // Draw the image into the backing canvas of the p5.Image
        pImg.drawingContext.drawImage(img, 0, 0);
        pImg.modified = true;

        if (typeof successCallback === 'function') {
            successCallback(pImg);
        }

        self._decrementPreload();
    };
    img.onerror = function (e) {
        p5._friendlyFileLoadError(0, img.src);
        if (typeof failureCallback === 'function') {
            failureCallback(e);
        }
    };

    //set crossOrigin in case image is served which CORS headers
    //this will let us draw to canvas without tainting it.
    //see https://developer.mozilla.org/en-US/docs/HTML/CORS_Enabled_Image
    // When using data-uris the file will be loaded locally
    // so we don't need to worry about crossOrigin with base64 file types
    if (path.indexOf('data:image/') !== 0) {
        img.crossOrigin = 'Anonymous';
    }

    return pImg;
};


type AppProps = {};

class App extends Component<AppProps> {

    render() {
        return (
            <div>
                <P5SynapseHunter />
            </div>
        );
    }
}


type P5SynapseHunterProps = {};


class P5SynapseHunter extends Component<P5SynapseHunterProps> {

    _id: string;
    sketch: any;
    config: Object;
    ghostLayer: number;
    layers: Object;
    p: P5Type;
    renderOrder: Array<string>;

    constructor(props) {
        super(props);
        let self = this;
        self._id = `p5-container-${Math.round(100 * Math.random())}`;

        self.sketch = (p: P5Type) => {

            p.setup = function() {
                let canvas = p.createCanvas(p.windowHeight, p.windowHeight);
                canvas.parent(self._id);
                self.ghostLayer = p.createGraphics(p.width, p.height);
                self.layers = {
                    crosshairs: new Crosshairs({p}),
                    bossdb: new BossDB({
                        p,
                        bossURI: `kasthuri2015/em/cc/`,
                        res: 1,
                        center: {x: 1700, y: 1700, z: 100},
                        range: {
                            x: [1400, 2000],
                            y: [1400, 2000],
                            z: [75, 120],
                        }
                    }),
                    trace: new Trace({p})
                };
                self.renderOrder = [
                    'bossdb',
                    'trace',
                    'crosshairs'
                ];

                self.config = {
                    renderCrosshairs: true,
                }
            };

            p.draw = function() {
                for (let key of self.renderOrder) {
                    self.layers[key].draw();
                }
            };

            p.windowResized = function() {
                p.resizeCanvas(500, 500);
            }

            p.mouseClicked = function() {
                for (const key in self.layers) {
                    if (!!self.layers[key].mouseClicked) {
                        self.layers[key].mouseClicked();
                    }
                }
            }

            p.keyTyped = function() {
                let key = p.key;
                if (key == "t") {
                    self.layers.crosshairs.toggleVisibility();
                }
                else if (key == "w") {
                    self.layers.bossdb.zUp();
                }
                else if (key == "s") {
                    self.layers.bossdb.zDown();
                }
            }

            p.mouseWheel = function(ev) {
                if (ev.delta > 0) {
                    self.layers.bossdb.zUp();
                } else {
                    self.layers.bossdb.zDown();
                }
            }
        };
    }

    componentDidMount() {
        var myp5 = new p5(this.sketch);
    }

    render() {
        return (
            <div id={ this._id }></div>
        )
    }
}

export default App;
