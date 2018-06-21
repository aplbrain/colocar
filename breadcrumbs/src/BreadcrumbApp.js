// @flow

import React, { Component } from 'react';

import type { P5Type } from "./types/p5Types";

import { Ramongo } from "./db";
import ImageManager from "./layers/ImageManager";
import TraceManager from "./layers/TraceManager";

import "./BreadcrumbApp.css";

let p5: P5Type = window.p5;

let DB = new Ramongo();

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

export default class BreadcrumbApp extends Component<any, any> {

    p5ID: string;
    sketch: any;
    ghostLayer: number;
    layers: Object;
    // p: P5Type;
    renderOrder: Array<string>;

    state: {
        traceMode?: boolean,
        ready?: boolean,
        scale?: number,
        currentZ?: number,
    };

    constructor(props: Object) {
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


                // The layers that will be rendered in the p5 scene.
                self.layers = {};
                self.renderOrder = [];

                DB.getNextQuestion(
                    window.keycloak.profile.username,
                    'NEURON.PAINT'
                ).then(({question, volume}) => {
                    console.log(question);
                    console.log(volume);

                    // TODO: @tucker helppppp
                    let synapseRemappedPosition = {
                        x: (question.synapse.x - volume.xLarge[0]),
                        y: (question.synapse.y - volume.yLarge[0]),
                        z: Math.round((question.synapse.z - volume.zLarge[0]))
                    };

                    // The electron microscopy imagery layer
                    let imageURIs = [
                        ...Array(volume.zLarge[1] - volume.zLarge[0]).keys()
                    ].map(i => i + volume.zLarge[0]).map(_z => {
                        return `https://api.theboss.io/v1/image/${volume.collection}/${volume.experiment}/${volume.channel}/xy/0/${volume.xLarge[0]}:${volume.xLarge[1]}/${volume.yLarge[0]}:${volume.yLarge[1]}/${_z}/?no-cache=true`;
                    });

                    self.layers["imageManager"] = new ImageManager({
                        p,
                        imageURIs,
                    });

                    self.layers["traceManager"] = new TraceManager({
                        p,
                        imageManager: self.layers.imageManager,
                        startingGraph: {
                            edges: [],
                            nodes: [{
                                v: question.synapse._id,
                                value: {
                                    ...synapseRemappedPosition,
                                    protected: true
                                }
                            }]
                        }
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
                    self.markAxon();
                    break;
                case 97:
                // case 37:
                    // left arrow is pressed
                    self.panLeft();
                    break;
                case 68:
                    self.markDendrite();
                    break;
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
                case 8:
                case 46:
                    self.deleteActiveNode();
                    break;
                case 49:
                    self.markBookmark();
                    break;
                case 50:
                    self.popBookmark();
                    break;
                default:
                    break;
                }
                // console.log(`Image ${self.layers["imageManager"].currentZ} at (${self.layers["imageManager"].position["x"]}, ${self.layers["imageManager"].position["y"]}) with ${Math.round(100*self.layers["imageManager"].scale)} scale.`);
            };

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
                if (!self.state.traceMode || p.mouseButton === p.RIGHT) {
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
        let curZ = this.layers.traceManager.getSelectedNodeZ();
        this.layers.imageManager.reset(curZ);
        this.setState({
            scale: this.layers.imageManager.scale,
            currentZ: curZ
            // currentZ: this.layers.imageManager.currentZ,
        });
    }

    markAxon(): void {
        this.layers.traceManager.markAxon();
    }

    markDendrite(): void {
        this.layers.traceManager.markDendrite();
    }

    markBookmark(): void {
        this.layers.traceManager.markBookmark();
    }
    popBookmark(): void {
        let {x, y, z} = this.layers.traceManager.popBookmark();
        this.layers.imageManager.setZ(z);
        // this.layers.imageManager.setY(y);
        // this.layers.imageManager.setX(x);
    }

    deleteActiveNode(): void {
        this.layers.traceManager.deleteActiveNode();
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
                            <button onClick={()=>this.scaleDown()}>-</button>
                            {Math.round(100 * this.state.scale)}%
                            <button onClick={()=>{this.scaleUp()}}>+</button>
                        </div>
                    </div>

                    <div style={STYLES["controlRow"]}>
                        <div style={STYLES["controlLabel"]}>Layer</div>

                        <div style={STYLES["controlToolInline"]}>
                            <button onClick={()=>this.decrementZ()}>-</button>
                            {this.state.currentZ + 1} / {this.layers.imageManager.images.length}
                            <button onClick={()=>this.incrementZ()}>+</button>
                        </div>
                    </div>

                    <div style={STYLES["controlRow"]}>
                        <button onClick={()=>this.reset()}>Reset viewport</button>
                    </div>

                    <div style={STYLES["controlRow"]}>
                        <button onClick={()=>this.setState({traceMode: !this.state.traceMode})}>
                            {this.state.traceMode ? "Switch to pan mode" : "Switch to trace mode"}
                        </button>
                    </div>
                </div> : null}
            </div>
        );
    }
}
