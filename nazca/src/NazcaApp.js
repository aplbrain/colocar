// @flow

import React, { Component } from 'react';
import * as graphlib from "graphlib";
import uuidv4 from "uuid/v4";


import type { P5Type } from "colocorazon/types/p5";

import { Colocard } from "./db";
import ImageManager from "./layers/ImageManager";
import TraceManager from "./layers/TraceManager";
import Scrollbar from "./layers/Scrollbar";
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import FloatingActionButton from "material-ui/FloatingActionButton";
import ActionThumbsUpDown from 'material-ui/svg-icons/action/thumbs-up-down';
import ActionThumbDown from 'material-ui/svg-icons/action/thumb-down';
import ActionThumbUp from 'material-ui/svg-icons/action/thumb-up';
import localForage from "localforage";

import "./NazcaApp.css";

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
    qid: {
        userSelect: "text"
    },
    yes: {
        position: "fixed",
        right: "2em",
        bottom: "6em"
    },
    no: {
        position: "fixed",
        right: "6em",
        bottom: "2em"
    },
    maybe: {
        position: "fixed",
        right: "2em",
        bottom: "2em"
    }
};

export default class NazcaApp extends Component<any, any> {

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
        submitInProgress: boolean
    };

    graphId: string;
    questionId: string;
    questionType: string;
    volume: Object;

    constructor(props: Object) {
        super(props);

        this.p5ID = "p5-container";
        this.state = {
            submitInProgress: false
        };

        // Create p5 sketch
        let self = this;
        self.sketch = (p: P5Type) => {
            p.setup = function() {
                let canvas = p.createCanvas(p.windowWidth, p.windowHeight);
                canvas.parent(self.p5ID);
                self.ghostLayer = p.createGraphics(p.width, p.height);

                canvas.mousePressed(function() {
                    self.layers.traceManager.mousePressed();
                    self.updateUIStatus();
                });

                // The layers that will be rendered in the p5 scene.
                self.layers = {};
                self.renderOrder = [];

                DB.getNextQuestion(
                    window.keycloak.profile.username,
                    DB.nazca_name
                ).then((res: { question: Object, volume: Object }) => {
                    if (!res || !res.question) {
                        alert("No remaining questions.");
                        return;
                    }
                    let question = res.question;
                    let colocardGraph = question.instructions.graph.structure;
                    let volume = res.volume;

                    self.graphId = question.instructions.graph._id;
                    self.questionId = question._id;
                    self.questionType = question.instructions.type;
                    self.volume = volume;
                    let batchSize = 10;

                    let graphlibGraph = self.graphlibFromColocard(colocardGraph);

                    self.layers["imageManager"] = new ImageManager({
                        p,
                        volume,
                        batchSize
                    });

                    self.layers["traceManager"] = new TraceManager({
                        p,
                        imageManager: self.layers.imageManager,
                        startingGraph: null
                    });

                    self.layers["scrollbar"] = new Scrollbar({
                        p,
                        imageManager: self.layers.imageManager,
                        traceManager: self.layers.traceManager,
                    });

                    // Set the order in which to render the layers. Removing layers
                    // from this array will cause them to not be rendered!
                    self.renderOrder = [
                        'imageManager',
                        'traceManager',
                        'scrollbar'
                    ];

                    self.setState({
                        ready: true,
                        scale: self.layers.imageManager.scale,
                        questionId: self.questionId,
                        currentZ: self.layers.imageManager.currentZ,
                        nodeCount: self.layers.traceManager.g.nodeCount()
                    });

                    self.insertStoredGraph(graphlibGraph);

                });

            };

            p.windowResized = function() {
                p.resizeCanvas(p.windowWidth, p.windowHeight);
            };

            p.keyPressed = function() {
                const aKey = 65;
                const bKey = 66;
                const dKey = 68;
                const eKey = 69;
                const mKey = 77;
                const nKey = 78;
                const qKey = 81;
                const sKey = 83;
                const tKey = 84;
                const wKey = 87;
                const upArrowKey = 38;
                const downArrowKey = 40;
                const leftArrowKey = 37;
                const rightArrowKey = 39;
                const plusKey = 187;
                const minusKey = 189;
                const escapeKey = 27;
                switch (p.keyCode) {
                // decision logic
                case bKey:
                    self.submitGraphDecision("yes");
                    break;
                case nKey:
                    self.submitGraphDecision("no");
                    break;
                case mKey:
                    self.submitGraphDecision("maybe");
                    break;
                // navigation (move image opposite to camera)
                case wKey:
                case upArrowKey:
                    self.panDown();
                    break;
                case sKey:
                case downArrowKey:
                    self.panUp();
                    break;
                case aKey:
                case leftArrowKey:
                    self.panRight();
                    break;
                case dKey:
                case rightArrowKey:
                    self.panLeft();
                    break;
                case qKey:
                    self.decrementZ();
                    break;
                case eKey:
                    self.incrementZ();
                    break;
                // view update
                case plusKey:
                    self.scaleUp();
                    break;
                case minusKey:
                    self.scaleDown();
                    break;
                case escapeKey:
                    self.reset();
                    break;
                case tKey:
                    self.toggleTraceVisibility();
                    break;
                default:
                    break;
                }

                self.updateUIStatus();
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
                if (e.ctrlKey || e.shiftKey) {
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

    updateUIStatus(): void {
        this.setState({
            currentZ: this.layers.imageManager.currentZ,
            nodeCount: this.layers.traceManager.g.nodes().length
        });
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
        });
    }

    toggleTraceVisibility(): void {
        this.layers.traceManager.toggleVisibility();
    }

    markBookmark(): void {
        this.layers.traceManager.markBookmark();
    }
    popBookmark(): void {
        // eslint-disable-next-line no-unused-vars
        let {x, y, z} = this.layers.traceManager.popBookmark();
        this.layers.imageManager.setZ(z);
    }

    componentDidMount() {
        new p5(this.sketch);
    }

    insertStoredGraph(parentGraph: Object) {
        this.setState({
            submitInProgress: true
        });
        localForage.getItem(
            `nazcaStorage-${this.questionId}`
        ).then(storedData => {
            let storedGraph = graphlib.json.read(storedData.graphStr);
            this.layers.traceManager.insertGraph(storedGraph, storedData.activeNodeId);
            this.setState({
                submitInProgress: false
            });
            this.reset();
            this.updateUIStatus();
        }).catch(() => {
            this.layers.traceManager.insertGraph(parentGraph);
            this.setState({
                submitInProgress: false
            });
            this.reset();
            this.updateUIStatus();
        });
    }

    graphlibFromColocard(graph: Object) {
        let xBounds = [this.volume.bounds[0][0], this.volume.bounds[1][0]];
        let yBounds = [this.volume.bounds[0][1], this.volume.bounds[1][1]];
        let zBounds = [this.volume.bounds[0][2], this.volume.bounds[1][2]];
        let output = new graphlib.Graph({
            directed: true,
            compound: false,
            multigraph: false
        });
        graph.nodes.forEach(oldNode => {
            let newNode = {};
            // Rescale the node centroids to align with p5-space, not data-space:
            let newX = oldNode.coordinate[0] - xBounds[0] - (
                (xBounds[1] - xBounds[0]) / 2
            );
            let newY = oldNode.coordinate[1] - yBounds[0] - (
                (yBounds[1] - yBounds[0]) / 2
            );
            let newZ = Math.round(oldNode.coordinate[2] - zBounds[0]);

            newNode.author = oldNode.author || window.keycloak.profile.username;
            newNode.x = newX;
            newNode.y = newY;
            newNode.z = newZ;
            newNode.created = oldNode.created;
            newNode.namespace = DB.nazca_name;
            newNode.type = oldNode.type;
            newNode.id = oldNode.id || uuidv4();
            newNode.volume = this.volume._id;
            output.setNode(newNode.id, newNode);
        });
        graph.links.forEach(e => {
            let newEdge = {};
            newEdge.v = e.source;
            newEdge.w = e.target;
            output.setEdge(newEdge);
        });
        return output;
    }

    graphlibToColocard(graph: Object) {
        let xBounds = [this.volume.bounds[0][0], this.volume.bounds[1][0]];
        let yBounds = [this.volume.bounds[0][1], this.volume.bounds[1][1]];
        let zBounds = [this.volume.bounds[0][2], this.volume.bounds[1][2]];
        let mappedNodes = graph.nodes().map(n => graph.node(n)).map(oldNode => {
            let newNode: Node = {};
            // Rescale the node centroids to align with data-space, not p5-space:
            let newX = oldNode.x + xBounds[0] + (
                (xBounds[1] - xBounds[0]) / 2
            );
            let newY = oldNode.y + yBounds[0] + (
                (yBounds[1] - yBounds[0]) / 2
            );
            let newZ = oldNode.z + zBounds[0];

            newNode.author = oldNode.author || window.keycloak.profile.username;
            newNode.coordinate = [newX, newY, newZ];
            newNode.created = oldNode.created;
            newNode.namespace = DB.nazca_name;
            newNode.type = oldNode.type;
            newNode.id = oldNode.id;
            newNode.volume = this.volume._id;
            return newNode;
        });
        let output = graphlib.json.write(graph);
        output.nodes = mappedNodes;
        output.edges = output.edges.map(e => {
            let newEdge = {};
            newEdge.source = e.v;
            newEdge.target = e.w;
            return newEdge;
        });
        return output;
    }

    submitGraphDecision(decision: string) {
        /*
        Submit a Decision to the database
        */
        this.setState({ submitInProgress: true });
        return DB.postGraphDecision(
            decision,
            window.keycloak.profile.username,
            this.graphId
        ).then(status => {
            // TODO: Do not reload page if failed; instead,
            // show error to user
            if (status === "completed") {
                return DB.updateQuestionStatus(this.questionId, status);
            } else {
                throw new Error("Failed to post - contact an admin.");
            }
        }).then(() => {
            this.setState({
                submitInProgress: true
            });
            return localForage.removeItem(
                `nazcaStorage-${this.questionId}`
            );
        }).then(() => {
            // eslint-disable-next-line no-restricted-globals
            location.reload(true);
        }).catch(err => {
            this.setState({
                submitInProgress: false
            });
            alert(err);
        });
    }

    render() {
        return (
            <div>
                <div id={this.p5ID} style={STYLES["p5Container"]}/>

                {this.state.ready ? <div style={STYLES["controlContainer"]}>
                    <table>
                        <tbody>
                            <tr>
                                <td>
                                    <div style={STYLES["controlLabel"]}>Zoom</div>
                                </td>
                                <td>
                                    <div style={STYLES["controlToolInline"]}>
                                        <button onClick={()=>this.scaleDown()}>-</button>
                                        {Math.round(100 * this.state.scale)}%
                                        <button onClick={()=>this.scaleUp()}>+</button>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <div style={STYLES["controlLabel"]}>Layer</div>
                                </td>
                                <td>
                                    <div style={STYLES["controlToolInline"]}>
                                        <button onClick={()=>this.decrementZ()}>-</button>
                                        {this.state.currentZ} / {this.layers.imageManager.nSlices - 1}
                                        <button onClick={()=>this.incrementZ()}>+</button>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <div style={STYLES["controlLabel"]}>Nodes</div>
                                </td>
                                <td>
                                    <div style={STYLES["controlToolInline"]}>
                                        {this.state.nodeCount}
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2}>
                                    <small style={STYLES["qid"]}>
                                        <code>
                                            {this.questionId || ""}
                                        </code>
                                    </small>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2}>
                                    <button onClick={()=>this.reset()}>Reset viewport</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <MuiThemeProvider>
                        <div>
                            <FloatingActionButton
                                style={STYLES["yes"]}
                                onClick={() => this.submitGraphDecision("yes")}
                                disabled={this.state.submitInProgress}
                                backgroundColor={"green"} >
                                <ActionThumbUp />
                            </FloatingActionButton>
                        </div>
                    </MuiThemeProvider>
                    <MuiThemeProvider>
                        <div>
                            <FloatingActionButton
                                style={STYLES["no"]}
                                onClick={() => this.submitGraphDecision("no")}
                                disabled={this.state.submitInProgress}
                                backgroundColor={"red"} >
                                <ActionThumbDown />
                            </FloatingActionButton>
                        </div>
                    </MuiThemeProvider>
                    <MuiThemeProvider>
                        <div>
                            <FloatingActionButton
                                style={STYLES["maybe"]}
                                onClick={() => this.submitGraphDecision("maybe")}
                                disabled={this.state.submitInProgress}
                                backgroundColor={"orange"} >
                                <ActionThumbsUpDown />
                            </FloatingActionButton>
                        </div>
                    </MuiThemeProvider>

                </div> : null}
            </div>
        );
    }
}
