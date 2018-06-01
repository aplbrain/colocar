// @flow

import React, { Component } from 'react';

import type { P5Type } from "./types/p5Types";

import ImageManager from "./layers/ImageManager";
import TraceManager from "./layers/TraceManager";

import "./BreadcrumbApp.css";

let p5: P5Type = window.p5;

const STYLES = {
    p5Container: {
        backgroundColor: "#808080",
        position:"fixed",
    },
    controlContainer: {
        position: "fixed",
        top: "15px",
        right: "15px",
        padding: "15px 15px 0 15px",
        userSelect: "none",
        backgroundColor: "#FFF",
    },
    controlRow: {
        marginBottom: '15px',
    },
    controlLabel: {
        float: "left",
        marginRight: "20px",
    },
    controlToolInline: {
        float: "right",
    },
};

export default class BreadcrumbApp extends Component {

    p5ID: string;
    sketch: any;
    ghostLayer: number;
    layers: Object;
    // p: P5Type;
    renderOrder: Array<string>;

    constructor(props) {
        super(props);

        this.p5ID = "p5-container";
        this.state = {
            traceMode: false,
        };

        // Create p5 sketch
        let self = this;
        self.sketch = (p: P5Type) => {
            p.setup = function() {
                let canvas = p.createCanvas(p.windowWidth, p.windowHeight);
                canvas.parent(self.p5ID);
                self.ghostLayer = p.createGraphics(p.width, p.height);

                // We don't need much in the way of framerate, and this saves
                // some RAM/CPU
                // p.frameRate(30);

                //!!!TEMP
                let imageURIs = [1,2,3,4,5,6,7,8,9,10,11,12].map(_z =>
                    `https://api.theboss.io/v1/image/kasthuri2015/ac4/em/xy/0/0:1024/0:1024/${_z}/?no-cache=true`);


                // The layers that will be rendered in the p5 scene.
                self.layers = {}
                // The electron microscopy imagery layer
                self.layers["imageManager"] = new ImageManager({
                    p,
                    imageURIs,
                });
                // The graph itself, as created by the user
                self.layers["traceManager"] = new TraceManager({
                    p,
                    imageManager: self.layers.imageManager,
                });

                // Set the order in which to render the layers. Removing layers
                // from this array will cause them to not be rendered!
                self.renderOrder = [
                    'imageManager',
                    'traceManager',
                ];

                self.setState({
                    ready: true,
                    scale: self.layers.imageManager.scale,
                    currentZ: self.layers.imageManager.currentZ,
                });
            };

            p.windowResized = function() {
                p.resizeCanvas(p.windowWidth, p.windowHeight);
            };

            p.keyPressed = function() {
                // QWASDE navigation, WASD for xy plane, QE to traverse z
                switch (p.keyCode) {
                    case 87:
                    case 119:
                    // case 38:
                        // "w" or up arrow is pressed
                        self.panUp();
                        break;
                    case 83:
                    case 115:
                    // case 40:
                        // "s" or down arrow is pressed
                        self.panDown();
                        break;
                    case 65:
                    case 97:
                    // case 37:
                        // "a" or left arrow is pressed
                        self.panLeft();
                        break;
                    case 68:
                    case 100:
                    // case 39:
                        // "d" or right arrow is pressed
                        self.panRight();
                        break;
                    case 81:
                    case 113:
                        // "q" is pressed
                        self.decrementZ();
                        break;
                    case 69:
                    case 101:
                        // "e" is pressed
                        self.incrementZ();
                        break;
                    case 187:
                        // "+" is pressed
                        self.scaleUp();
                        break;
                    case 189:
                        // "-" is pressed
                        self.scaleDown();
                        break;
                    case 27:
                        // "esc" is pressed, all reset
                        self.reset();
                        break;
                    case 9:
                        // "tab" toggles the tracing mouseDragged
                        self.setState({traceMode: !self.state.traceMode});
                        break;
                    default:
                        break;

                }
                // console.log(`Image ${self.layers["imageManager"].currentZ} at (${self.layers["imageManager"].position["x"]}, ${self.layers["imageManager"].position["y"]}) with ${Math.round(100*self.layers["imageManager"].scale)} scale.`);
            }

            p.mousePressed = function() {
                if (self.state.traceMode) {
                    self.layers.traceManager.mousePressed();
                }
            };

            p.mouseClicked = function() {
                if (self.state.traceMode) {
                    self.layers.traceManager.mouseClicked();
                }
            };

            p.mouseDragged = function() {
                if (!self.state.traceMode || p.mouseButton == p.RIGHT) {
                    // Only drag the image if mouse is in the image.
                    if (self.layers.imageManager.imageCollision(p.mouseX, p.mouseY)) {
                        let dX = p.pmouseX - p.mouseX;
                        let dY = p.pmouseY - p.mouseY;

                        self.layers.imageManager.setPosition(self.layers.imageManager.position.x - dX, self.layers.imageManager.position.y - dY);
                    }
                }
            };

            p.mouseWheel = function(e) {
                // Handle pinch-to-zoom functionality
                if (e.ctrlKey) {
                    if (e.wheelDelta < 0) {
                        self.scaleDown();
                    } else {
                        self.scaleUp();
                    }
                } else {
                    if (e.wheelDelta < 0) {
                        self.incrementZ();
                    } else {
                        self.decrementZ();
                    }
                }
            };

            p.draw = function() {
                p.clear();
                // Draw every layer, in order:
                for (let layer of self.renderOrder) {
                    self.layers[layer].draw();
                }
            };
        };
    }

    panUp(): void {
        this.layers.imageManager.panUp();
    }

    panDown(): void {
        this.layers.imageManager.panDown();
    }

    panLeft(): void {
        this.layers.imageManager.panLeft();
    }

    panRight(): void {
        this.layers.imageManager.panRight();
    }

    scaleUp(): void {
        this.layers.imageManager.scaleUp();
        this.setState({scale: this.layers.imageManager.scale});
    }

    scaleDown(): void {
        this.layers.imageManager.scaleDown();
        this.setState({scale: this.layers.imageManager.scale});
    }

    incrementZ(): void {
        this.layers.imageManager.incrementZ();
        this.setState({currentZ: this.layers.imageManager.currentZ});
    }

    decrementZ(): void {
        this.layers.imageManager.decrementZ();
        this.setState({currentZ: this.layers.imageManager.currentZ});
    }

    reset(): void {
        this.layers["imageManager"].reset();
        this.setState({
            scale: this.layers["imageManager"].scale,
            currentZ: this.layers["imageManager"].currentZ,
        });
    }

    componentDidMount() {
        new p5(this.sketch);
    }

    render() {
        return (
            <div>
                <div id={this.p5ID} style={STYLES["p5Container"]}/>

                {this.state.ready ? <div style={STYLES["controlContainer"]}>
                    <div style={STYLES["controlRow"]}>
                        <div style={STYLES["controlLabel"]}>Zoom</div>

                        <div style={STYLES["controlToolInline"]}>
                            <button onClick={()=>{this.scaleDown()}}>-</button>
                            {Math.round(100 * this.state.scale)}%
                            <button onClick={()=>{this.scaleUp()}}>+</button>
                        </div>
                    </div>

                    <div style={STYLES["controlRow"]}>
                        <div style={STYLES["controlLabel"]}>Layer</div>

                        <div style={STYLES["controlToolInline"]}>
                            <button onClick={()=>{this.decrementZ()}}>-</button>
                            {this.state.currentZ + 1} / {this.layers.imageManager.images.length}
                            <button onClick={()=>{this.incrementZ()}}>+</button>
                        </div>
                    </div>

                    <div style={STYLES["controlRow"]}>
                        <button onClick={()=>{this.reset()}}>Reset viewport</button>
                    </div>

                    <div style={STYLES["controlRow"]}>
                        <button onClick={()=>{this.setState({traceMode: !this.state.traceMode})}}>
                            {this.state.traceMode ? "Switch to pan mode" : "Switch to trace mode"}
                        </button>
                    </div>
                </div> : null}
            </div>
        );
    }
}
