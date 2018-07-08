// @flow

import React, { Component } from 'react';
import * as graphlib from "graphlib";


import type { P5Type } from "./types/p5Types";

import { Colocard } from "./db";
import ImageManager from "./layers/ImageManager";
import TraceManager from "./layers/TraceManager";
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider'
import FloatingActionButton from "material-ui/FloatingActionButton";
import ContentSend from "material-ui/svg-icons/content/send";
import localForage from "localforage";

import "./BreadcrumbApp.css";

let p5: P5Type = window.p5;

let DB = new Colocard();

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
    submit: {
        position: "fixed",
        left: "2em",
        bottom: "2em"
    }
};

export default class BreadcrumbApp extends Component<any, any> {

    p5ID: string;
    sketch: any;
    ghostLayer: number;
    layers: Object;
    // p: P5Type;
    renderOrder: Array<string>;

    state: {
        ready?: boolean,
        scale?: number,
        currentZ?: number,
    };

    questionId: string;
    volume: Object;

    constructor(props: Object) {
        super(props);

        this.p5ID = "p5-container";
        this.state = {};

        // Create p5 sketch
        let self = this;
        self.sketch = (p: P5Type) => {
            p.setup = function() {
                let canvas = p.createCanvas(p.windowWidth, p.windowHeight);
                canvas.parent(self.p5ID);
                self.ghostLayer = p.createGraphics(p.width, p.height);

                canvas.mousePressed(function() {
                    self.layers.traceManager.mousePressed();
                });

                canvas.mouseClicked(function() {
                    self.layers.traceManager.mouseClicked();
                });

                // We don't need much in the way of framerate, and this saves
                // some RAM/CPU
                // p.frameRate(30);


                // The layers that will be rendered in the p5 scene.
                self.layers = {};
                self.renderOrder = [];

                DB.getNextQuestion(
                    window.keycloak.profile.username,
                    DB.breadcrumbs_name
                ).then((res: { question: Object, volume: Object }) => {
                    if (!res || !res.question) {
                        alert("No remaining questions.");
                        return;
                    }
                    let question = res.question;
                    let startingGraph = question.instructions.graph;
                    let volume = res.volume;
                    console.log(question);
                    console.log(volume);
                    console.log(startingGraph);

                    // TODO: Graphs will have more than one node! Filter for the starting node.
                    let startingSynapse = startingGraph.structure.nodes[0];

                    self.questionId = question._id;
                    self.volume = volume;

                    // The electron microscopy imagery layer
                    let xBounds = [volume.bounds[0][0], volume.bounds[1][0]];
                    let yBounds = [volume.bounds[0][1], volume.bounds[1][1]];
                    let zBounds = [volume.bounds[0][2], volume.bounds[1][2]];
                    let imageURIs = [
                        ...Array(zBounds[1] - zBounds[0]).keys()
                    ].map(i => i + zBounds[0]).map(_z => {
                        return `https://api.theboss.io/v1/image/${volume.collection}/${volume.experiment}/${volume.channel}/xy/0/${xBounds[0]}:${xBounds[1]}/${yBounds[0]}:${yBounds[1]}/${_z}/?no-cache=true`;
                    });

                    let synapseRemappedPosition = {
                        x: startingSynapse.coordinate[0] - xBounds[0] - ((xBounds[1] - xBounds[0])/2),
                        y: startingSynapse.coordinate[1] - yBounds[0] - ((yBounds[1] - yBounds[0])/2),
                        z: Math.round(startingSynapse.coordinate[2] - zBounds[0])
                    };

                    self.layers["imageManager"] = new ImageManager({
                        p,
                        imageURIs,
                        startingZ: synapseRemappedPosition.z
                    });

                    self.layers["traceManager"] = new TraceManager({
                        p,
                        imageManager: self.layers.imageManager,
                        startingGraph: {
                            links: [],
                            nodes: [{
                                id: startingSynapse.id,
                                x: synapseRemappedPosition.x,
                                y: synapseRemappedPosition.y,
                                z: synapseRemappedPosition.z,
                                protected: true
                            }]
                        },
                        activeNodeId: startingSynapse.id
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
                        questionId: question._id,
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
            };

            p.mouseDragged = function() {
                if (p.mouseButton === p.RIGHT) {
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
    }

    deleteActiveNode(): void {
        this.layers.traceManager.deleteActiveNode();
    }

    componentDidMount() {
        new p5(this.sketch);
    }

    saveGraph() {

    }

    submitGraph() {
        /*
        Submit the Graph to the database
        */
        // eslint-disable-next-line no-restricted-globals
        let certain = confirm("Attempting to submit. Are you sure that your data are ready?");
        if (certain) {
            let graph = this.layers.traceManager.g;
            let transformedGraph = graph;
            return DB.postGraph(
                transformedGraph,
                this.volume._id,
                window.keycloak.profile.username
            ).then(status => {
                // TODO: Do not reload page if failed; instead,
                // show error to user
                return DB.updateQuestionStatus(this.questionId, status);
            }).then(() => {
                return localForage.removeItem(`breadcrumbsStorage-${this.questionId}`);
            }).then(() => {
                // eslint-disable-next-line no-restricted-globals
                location.reload(true);
            });
        }
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
                            <button onClick={()=>this.scaleUp()}>+</button>
                        </div>
                    </div>

                    <div style={STYLES["controlRow"]}>
                        <div style={STYLES["controlLabel"]}>Layer</div>

                        <div style={STYLES["controlToolInline"]}>
                            <button onClick={()=>this.decrementZ()}>-</button>
                            {this.state.currentZ} / {this.layers.imageManager.images.length - 1}
                            <button onClick={()=>this.incrementZ()}>+</button>
                        </div>
                    </div>

                    <div style={STYLES["controlRow"]}>
                        <button onClick={()=>this.reset()}>Reset viewport</button>
                    </div>

                    <MuiThemeProvider>
                        <div>
                            <FloatingActionButton
                                style={STYLES["submit"]}
                                onClick={() => this.submitGraph()}>
                                <ContentSend />
                            </FloatingActionButton>
                        </div>
                    </MuiThemeProvider>

                </div> : null}
            </div>
        );
    }
}
