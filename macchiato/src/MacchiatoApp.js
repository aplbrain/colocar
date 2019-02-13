// @flow

import React, { Component } from 'react';

import type { P5Type } from "colocorazon/dist/types/p5";

import { Colocard } from "./db";
import ImageManager from "./layers/ImageManager";
import SynapseManager from "./layers/SynapseManager";
import Scrollbar from "./layers/Scrollbar";
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import FloatingActionButton from "material-ui/FloatingActionButton";
import ActionThumbsUpDown from 'material-ui/svg-icons/action/thumbs-up-down';
import ActionThumbDown from 'material-ui/svg-icons/action/thumb-down';
import ActionThumbUp from 'material-ui/svg-icons/action/thumb-up';

import "./MacchiatoApp.css";

let p5: P5Type = window.p5;

let DB = new Colocard();

const XY_RADIUS = 100;
const Z_RADIUS = 10;
const BATCH_SIZE = 1;

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

export default class MacchiatoApp extends Component<any, any> {

    p5ID: string;
    sketch: any;
    layers: Object;
    // p: P5Type;
    renderOrder: Array<string>;

    state: {
        ready?: boolean,
        scale?: number,
        currentZ?: number,
        submitInProgress: boolean
    };

    nodeId: string;
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

                // The layers that will be rendered in the p5 scene.
                self.layers = {};
                self.renderOrder = [];

                DB.getNextQuestion(
                    window.keycloak.profile.username,
                    DB.macchiatoAppName
                ).then((res: { question: Object, volume: Object }) => {
                    if (!res || !res.question) {
                        throw new Error("failed to fetch question");
                    }
                    let question = res.question;
                    let volume = res.volume;

                    self.nodeId = question.instructions.node._id;
                    self.questionId = question._id;
                    self.questionType = question.instructions.type;
                    self.volume = volume;
                    // Tighten the crop around the node:
                    let node = question.instructions.node;
                    // Use JSON to deep copy
                    let lowerLimits = JSON.parse(
                        JSON.stringify(self.volume.bounds[0])
                    );
                    let upperLimits = JSON.parse(
                        JSON.stringify(self.volume.bounds[1])
                    );
                    self.volume.bounds[0] = [
                        Math.round(node.coordinate[0] - XY_RADIUS),
                        Math.round(node.coordinate[1] - XY_RADIUS),
                        Math.round(node.coordinate[2] - Z_RADIUS),
                    ];
                    self.volume.bounds[1] = [
                        Math.round(node.coordinate[0] + XY_RADIUS),
                        Math.round(node.coordinate[1] + XY_RADIUS),
                        Math.round(node.coordinate[2] + Z_RADIUS),
                    ];

                    node.coordinate = [0, 0, 0];

                    // Handle floor and ceiling values
                    for (let coordIx = 0; coordIx < 3; coordIx++) {
                        let lowerOffset = self.volume.bounds[0][coordIx] - lowerLimits[coordIx];
                        let upperOffset = self.volume.bounds[1][coordIx] - upperLimits[coordIx];
                        if (lowerOffset < 0) {
                            node.coordinate[coordIx] += lowerOffset/2;
                            self.volume.bounds[0][coordIx] = lowerLimits[coordIx];
                        }
                        else if (upperOffset > 0) {
                            node.coordinate[coordIx] += upperOffset/2;
                            self.volume.bounds[1][coordIx] = upperLimits[coordIx];
                        }
                    }

                    self.layers["imageManager"] = new ImageManager({
                        p,
                        volume: self.volume,
                        batchSize: BATCH_SIZE
                    });

                    self.layers["synapse"] = new SynapseManager({
                        p,
                        imageManager: self.layers.imageManager,
                        node: node
                    });

                    self.layers["scrollbar"] = new Scrollbar({
                        p,
                        imageManager: self.layers.imageManager,
                        traceManager: self.layers.traceManager,
                    });

                    // Set the order in which to render the layers. Removing layers
                    // from this array will cause them to not be rendered!
                    self.renderOrder = [
                        "imageManager",
                        "synapse",
                        "scrollbar"
                    ];

                    self.setState({
                        ready: true,
                        scale: self.layers.imageManager.scale,
                        questionId: self.questionId,
                        currentZ: self.layers.imageManager.currentZ,
                    });

                }).catch(err => alert(err));

            };

            p.windowResized = function() {
                p.resizeCanvas(p.windowWidth, p.windowHeight);
            };

            p.keyPressed = function() {
                // Navigation
                const aKey = 65;
                const eKey = 69;
                const dKey = 68;
                const qKey = 81;
                const sKey = 83;
                const wKey = 87;

                // Interaction
                const tKey = 84;

                // Submit answer
                const bKey = 89;
                const yKey = 66;
                const mKey = 77;
                const nKey = 78;

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
                    self.submitNodeDecision("yes");
                    break;
                case nKey:
                    self.submitNodeDecision("no");
                    break;
                case mKey:
                    self.submitNodeDecision("maybe");
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
                    self.toggleSynapseVisibility();
                    break;
                default:
                    break;
                }

                self.updateUIStatus();
            };

            p.mouseDragged = function() {
                if (p.mouseButton === p.RIGHT) {
                    let dX = p.pmouseX - p.mouseX;
                    let dY = p.pmouseY - p.mouseY;

                    self.layers.imageManager.setPosition(self.layers.imageManager.position.x - dX, self.layers.imageManager.position.y - dY);
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
        let curZ = 0;
        this.layers.imageManager.reset(curZ);
        this.setState({
            scale: this.layers.imageManager.scale,
            currentZ: curZ
        });
    }

    toggleSynapseVisibility(): void {
        this.layers.synapse.toggleVisibility();
    }

    componentDidMount() {
        new p5(this.sketch);
    }

    submitNodeDecision(decision: string) {
        /*
        Submit a Decision to the database
        */
        this.setState({ submitInProgress: true });
        return DB.postNodeDecision(
            decision,
            window.keycloak.profile.username,
            this.nodeId
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
                                onClick={() => this.submitNodeDecision("yes")}
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
                                onClick={() => this.submitNodeDecision("no")}
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
                                onClick={() => this.submitNodeDecision("maybe")}
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
