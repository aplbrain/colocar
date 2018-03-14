// @flow

import React, { Component } from 'react';
import Visualizer from 'apl-substrate/components/Visualizer';
import Layer from 'apl-substrate/components/Layer';

import './App.css';

import BossDB from "./layers/BossDB";
import Crosshairs from "./layers/Crosshairs";
import Trace from "./layers/Trace";

import type { P5Type } from "./types/p5";

// import p5 from 'p5';


let p5: P5Type = window.p5;

p5.prototype.loadImage = function (path: string, successCallback: Function, failureCallback: Function, headers: Object) {
    p5._validateParameters('loadImage', arguments);
    var img = new Image();
    var pImg = new p5.Image(1, 1, this);

    let self = this;

    let URL = window.URL || window.webkitURL;
    headers = headers || {};

    fetch(path, {
        headers,
    }).then(res => {
        if (res.ok) {
            res.blob().then(b => {
                // Start loading the image:
                img.src = URL.createObjectURL(b);
            });
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
            <div style={{ height: "100vh", overflow: "hidden" }}>
                <P5Breadcrumbs />
            </div>
        );
    }
}


class AxisLayer extends Layer {

    requestInit(scene) {
        this.children.push(scene.add(new window.THREE.AxesHelper(5)));
    }
}


class GraphLayer extends Layer {
    constructor(opts) {
        super(opts);
        this.graph = {
            nodes: [],
            edges: []
        };
    }

    setGraph(g) {
        this.graph = g;
        this.requestInit();
    }

    requestInit(scene) {
        if (scene) { this.scene = scene; }
        scene = scene || this.scene;

        for (let n of this.children) {
            scene.remove(n);
        }
        this.children = [];

        for (let n of this.graph.nodes) {
            let newNode = new window.THREE.Mesh(
                new window.THREE.SphereGeometry(0.1, 2, 2),
                new window.THREE.MeshBasicMaterial({color: 0xc0ffee})
            );
            newNode.position.set(n.value.x/50, n.value.y/50, (n.value.z - 100) / 5);
            this.children.push(scene.add(newNode));
        }
    }
}


type P5BreadcrumbsProps = {};

class P5Breadcrumbs extends Component<P5BreadcrumbsProps> {

    p5ID: string;
    substrateID: string;
    sketch: any;
    config: Object;
    ghostLayer: number;
    layers: Object;
    p: P5Type;
    renderOrder: Array<string>;
    V: Object;

    frameUp: Function;

    constructor(props) {
        super(props);
        let self = this;
        self.p5ID = `p5-container-${Math.round(100 * Math.random())}`;
        self.substrateID = `substrate-container-${Math.round(100 * Math.random())}`;


        // Set up substrate scene
        self.V = new Visualizer({
            targetElement: self.substrateID,
            renderLayers: {
                axis: new AxisLayer(),
                graph: new GraphLayer()
            }
        });

        // Set up p5 sketch
        self.sketch = (p: P5Type) => {

            p.setup = function() {
                let canvas = p.createCanvas(p.windowHeight, p.windowHeight);
                canvas.parent(self.p5ID);
                self.ghostLayer = p.createGraphics(p.width, p.height);

                p.frameRate(10);
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

                self.layers.trace.setFrame(self.layers.bossdb.currentZ);

                self.renderOrder = [
                    'bossdb',
                    'trace',
                    'crosshairs'
                ];

                self.config = {
                    renderCrosshairs: true,
                };
            };

            p.draw = function() {
                for (let key of self.renderOrder) {
                    self.layers[key].draw();
                }
            };

            p.windowResized = function() {
                p.resizeCanvas(500, 500);
            };

            p.mousePressed = function() {
                for (const key in self.layers) {
                    if (self.layers[key].mousePressed) {
                        self.layers[key].mousePressed();
                    }
                }
                return false;
            };

            p.keyTyped = function() {
                let key = p.key;

                switch (key) {
                case "t":
                    self.layers.crosshairs.toggleVisibility();
                    break;

                case "w":
                    self.frameUp();
                    break;

                case "s":
                    self.frameDown();
                    break;

                case "c":
                    self.layers.trace.severTrace();
                    break;

                case "x":
                    self.layers.trace.deleteActiveNode();
                    break;

                case "v":
                    self.layers.trace.toggleVisibility();
                    break;

                case " ":
                    self.layers.trace.dropNode();
                    break;
                default:
                    break;
                }
            };

            p.mouseWheel = function(ev) {
                if (ev.delta > 0) {
                    self.frameUp();
                } else {
                    self.frameDown();
                }
            };
        };
    }

    frameUp(): void {
        this.layers.bossdb.zUp();
        this.layers.trace.setFrame(this.layers.bossdb.currentZ);
    }
    frameDown(): void {
        this.layers.bossdb.zDown();
        this.layers.trace.setFrame(this.layers.bossdb.currentZ);
        this.V.renderLayers.graph.setGraph(this.layers.trace.getGraph());
    }

    componentDidMount() {
        new p5(this.sketch);
        this.V.triggerRender();
        window.V = this.V;
        this.V.resize();
    }

    render() {
        return (
            <div style={{
                display: "inline-grid",
                gridGap: "5px",
                gridTemplateColumns: "100vh 20vw auto",
            }}>
                <div id={ this.p5ID }></div>
                <div
                    style={{
                        position: "relative",
                    }} id={ this.substrateID }></div>
                <div></div>
            </div>
        );
    }
}

export default App;
