// @flow

import React, { Component } from 'react';
import * as graphlib from "graphlib";
import uuidv4 from "uuid/v4";


import type { P5Type } from "colocorazon/dist/types/p5";

import { Colocard } from "./db";
import ImageManager from "./layers/ImageManager";
import TraceManager from "./layers/TraceManager";
import Scrollbar from "./layers/Scrollbar";
import Button from "@material-ui/core/Button";
import Fab from "@material-ui/core/Fab";
import Snackbar from "@material-ui/core/Snackbar";
import ActionThumbsUpDown from '@material-ui/icons/ThumbsUpDown';
import ActionThumbDown from '@material-ui/icons/ThumbDown';
import ActionThumbUp from '@material-ui/icons/ThumbUp';
import localForage from "localforage";

import "./NazcaApp.css";

let p5: P5Type = window.p5;

let DB = new Colocard();

const CANDIDATE_LEGEND_COLOR = "rgb(255, 192, 0)";
const CANDIDATE_NODE_COLOR = {"r": 255, "g": 192, "b": 0};
const CANDIDATE_EDGE_COLOR = {"r": 255, "g": 128, "b": 0};

const CONTEXT_LEGEND_COLOR = "rgb(200, 90, 200)";
const CONTEXT_NODE_COLOR = {"r": 200, "g": 90, "b": 200};
const CONTEXT_EDGE_COLOR = {"r": 170, "g": 60, "b": 170};

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
    graphLegendCandidate: {
        backgroundColor: CANDIDATE_LEGEND_COLOR,
        color: "white"
    },
    graphLegendContext: {
        backgroundColor: CONTEXT_LEGEND_COLOR,
        color: "white"
    },
    yes: {
        position: "fixed",
        right: "2em",
        bottom: "10em",
        backgroundColor: "green"
    },
    no: {
        position: "fixed",
        right: "6em",
        bottom: "6em",
        backgroundColor: "red"
    },
    maybe: {
        position: "fixed",
        right: "2em",
        bottom: "6em",
        backgroundColor: "orange"
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

    candidateId: string;
    questionId: string;
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
                    self.layers.traceManagerContext.mousePressed();
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
                        throw new Error("failed to fetch question");
                    }
                    let question = res.question;
                    let colocardGraphCandidate = question.instructions.candidate.structure;
                    let colocardGraphContext = question.instructions.context.structure;
                    let volume = res.volume;

                    self.candidateId = question.instructions.candidate._id;
                    self.prompt = question.instructions.prompt;
                    self.questionId = question._id;
                    self.volume = volume;
                    let batchSize = 10;

                    let graphlibGraphCandidate = self.graphlibFromColocard(colocardGraphCandidate);
                    let graphlibGraphContext = self.graphlibFromColocard(colocardGraphContext);
                    let startingZ = graphlibGraphCandidate.node(graphlibGraphCandidate.nodes()[0]).z;

                    self.layers["imageManager"] = new ImageManager({
                        p,
                        volume,
                        batchSize,
                        startingZ: startingZ
                    });

                    self.layers["traceManagerCandidate"] = new TraceManager({
                        p,
                        imageManager: self.layers.imageManager,
                        startingGraph: null,
                        nodeColor: CANDIDATE_NODE_COLOR,
                        edgeColor: CANDIDATE_EDGE_COLOR
                    });

                    self.layers["traceManagerContext"] = new TraceManager({
                        p,
                        imageManager: self.layers.imageManager,
                        startingGraph: null,
                        nodeColor: CONTEXT_NODE_COLOR,
                        edgeColor: CONTEXT_EDGE_COLOR
                    });

                    self.layers["scrollbar"] = new Scrollbar({
                        p,
                        imageManager: self.layers.imageManager,
                        traceManager: self.layers.traceManagerCandidate
                    });

                    // Set the order in which to render the layers. Removing layers
                    // from this array will cause them to not be rendered!
                    self.renderOrder = [
                        'imageManager',
                        'traceManagerContext',
                        'traceManagerCandidate',
                        'scrollbar'
                    ];

                    self.setState({
                        currentZ: self.layers.imageManager.currentZ,
                        nodeCount: self.layers.traceManagerCandidate.g.nodeCount(),
                        questionId: self.questionId,
                        ready: true,
                        scale: self.layers.imageManager.scale,
                        snackbarOpen: true
                    });

                    self.layers.traceManagerCandidate.g = graphlibGraphCandidate;
                    self.layers.traceManagerContext.g = graphlibGraphContext;

                }).catch(err => alert(err));

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
                const yKey = 66;
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
                case yKey:
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
                let delta = 0;
                if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                    delta = e.deltaX;
                } else {
                    delta = e.deltaY;
                }
                // Handle pinch-to-zoom functionality
                if (e.ctrlKey || e.shiftKey) {
                    if (delta > 0) {
                        self.scaleDown();
                    } else {
                        self.scaleUp();
                    }
                } else {
                    if (delta > 0) {
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
            nodeCount: this.layers.traceManagerCandidate.g.nodes().length
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
        let curZ = this.layers.traceManagerCandidate.getSelectedNodeZ();
        this.layers.imageManager.reset(curZ);
        this.setState({
            scale: this.layers.imageManager.scale,
            currentZ: curZ
        });
    }

    toggleTraceVisibility(): void {
        this.layers.traceManagerCandidate.toggleVisibility();
        this.layers.traceManagerContext.toggleVisibility();
    }

    componentDidMount() {
        new p5(this.sketch);
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
            this.candidateId
        ).then(status => {
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

    handleSnackbarClose() {
        this.setState({ snackbarOpen: false });
    }
    handleSnackbarOpen() {
        this.setState({ snackbarOpen: true });
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
                                    <div style={STYLES["graphLegendCandidate"]}>
                                        Candidate
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2}>
                                    <div style={STYLES["graphLegendContext"]}>
                                        Context
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2}>
                                    <button onClick={()=>this.reset()}>Reset viewport</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <Snackbar
                        open={this.state.snackbarOpen}
                        onClose={()=>this.handleSnackbarClose()}
                        ContentProps={{
                            'aria-describedby': 'message-id'
                        }}
                        action={[
                            <Button key="undo" color="secondary" size="small" onClick={()=>this.handleSnackbarClose()}>
                            GOT IT
                            </Button>
                        ]}
                        message={<div id="message-id">
                            <div>{this.prompt}</div>
                            <div>Task ID: {this.questionId}</div>
                        </div>}
                    />

                    <Fab
                        style={STYLES["yes"]}
                        onClick={() => this.submitGraphDecision("yes")}
                        disabled={this.state.submitInProgress}
                        color="primary" >
                        <ActionThumbUp />
                    </Fab>
                    <Fab
                        style={STYLES["no"]}
                        onClick={() => this.submitGraphDecision("no")}
                        disabled={this.state.submitInProgress}
                        color="primary" >
                        <ActionThumbDown />
                    </Fab>
                    <Fab
                        style={STYLES["maybe"]}
                        onClick={() => this.submitGraphDecision("maybe")}
                        disabled={this.state.submitInProgress}
                        color="primary" >
                        <ActionThumbsUpDown />
                    </Fab>

                </div> : null}
            </div>
        );
    }
}
