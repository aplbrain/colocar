// @flow

import React, { Component } from 'react';
import * as graphlib from "graphlib";
import uuidv4 from "uuid/v4";


import type { P5Type } from "./types/p5Types";

import { Colocard } from "./db";
import ImageManager from "./layers/ImageManager";
import TraceManager from "./layers/TraceManager";
import Scrollbar from "./layers/Scrollbar";
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import FloatingActionButton from "material-ui/FloatingActionButton";
import ContentSave from "material-ui/svg-icons/content/save";
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
    qid: {
        userSelect: "text"
    },
    save: {
        position: "fixed",
        left: "2em",
        bottom: "2em"
    },
    submit: {
        position: "fixed",
        right: "2em",
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
        saveInProgress: boolean
    };

    questionId: string;
    volume: Object;

    constructor(props: Object) {
        super(props);

        this.p5ID = "p5-container";
        this.state = {
            saveInProgress: false
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

                canvas.mouseClicked(function() {
                    self.layers.traceManager.mouseClicked();
                    self.updateUIStatus();
                });

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
                    let colocardGraph = question.instructions.graph.structure;
                    let volume = res.volume;
                    console.log(question);
                    console.log(volume);

                    self.questionId = question._id;
                    self.volume = volume;

                    // The electron microscopy imagery layer
                    let xBounds = [volume.bounds[0][0], volume.bounds[1][0]];
                    let yBounds = [volume.bounds[0][1], volume.bounds[1][1]];
                    let zBounds = [volume.bounds[0][2], volume.bounds[1][2]];
                    let imageURIs = [
                        ...Array(zBounds[1] - zBounds[0]).keys()
                    ].map(i => i + zBounds[0]).map(_z => {
                        return `https://api.theboss.io/v1/image/${volume.collection}/${volume.experiment}/${volume.channel}/xy/${volume.resolution}/${xBounds[0]}:${xBounds[1]}/${yBounds[0]}:${yBounds[1]}/${_z}/?no-cache=true`;
                    });

                    let graphlibGraph = self.graphlibFromColocard(colocardGraph);

                    self.layers["imageManager"] = new ImageManager({
                        p,
                        imageURIs
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
                        questionId: question._id,
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
                const dKey = 68;
                const eKey = 69;
                const hKey = 72;
                const qKey = 81;
                const tKey = 84;
                const upArrowKey = 38;
                const downArrowKey = 40;
                const leftArrowKey = 37;
                const rightArrowKey = 39;
                const plusKey = 187;
                const minusKey = 189;
                const escapeKey = 27;
                const exclamationKey = 49;
                const atSignKey = 50;
                const backspaceKey = 8;
                switch (p.keyCode) {
                // navigation (move image opposite to camera)
                case upArrowKey:
                    self.panDown();
                    break;
                case downArrowKey:
                    self.panUp();
                    break;
                case leftArrowKey:
                    self.panRight();
                    break;
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
                case hKey:
                    self.stopHinting();
                    break;
                case tKey:
                    self.toggleTraceVisibility();
                    break;
                // label nodes
                case aKey:
                    self.markAxon();
                    break;
                case dKey:
                    self.markDendrite();
                    break;
                // bookmarking
                case exclamationKey:
                    self.markBookmark();
                    break;
                case atSignKey:
                    self.popBookmark();
                    break;
                // deletion
                case backspaceKey:
                    self.deleteActiveNode();
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

    markAxon(): void {
        this.layers.traceManager.markNodeType("presynaptic");
    }

    markDendrite(): void {
        this.layers.traceManager.markNodeType("postsynaptic");
    }

    stopHinting(): void {
        this.layers.traceManager.stopHinting();
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

    deleteActiveNode(): void {
        this.layers.traceManager.deleteActiveNode();
    }

    componentDidMount() {
        new p5(this.sketch);
    }

    insertStoredGraph(parentGraph: Object) {
        this.setState({
            saveInProgress: true
        });
        localForage.getItem(
            `breadcrumbsStorage-${this.questionId}`
        ).then(storedData => {
            let storedGraph = graphlib.json.read(storedData.graphStr);
            this.layers.traceManager.insertGraph(storedGraph, storedData.activeNodeId);
            this.setState({
                saveInProgress: false
            });
            this.reset();
            this.updateUIStatus();
        }).catch(() => {
            this.layers.traceManager.insertGraph(parentGraph);
            this.setState({
                saveInProgress: false
            });
            this.reset();
            this.updateUIStatus();
        });
    }

    saveGraph() {
        this.setState({
            saveInProgress: true
        });
        let graphStr = graphlib.json.write(this.layers.traceManager.g);
        let activeNodeId = this.layers.traceManager.activeNode.id || this.layers.traceManager.activeNode._id;
        localForage.setItem(
            `breadcrumbsStorage-${this.questionId}`,
            {
                graphStr,
                activeNodeId
            }
        ).then(() => {
            this.setState({
                saveInProgress: false
            });
            console.log("saved graph!");
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
            newNode.namespace = DB.breadcrumbs_name;
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
            newNode.namespace = DB.breadcrumbs_name;
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

    submitGraph() {
        /*
        Submit the Graph to the database
        */
        this.setState({ saveInProgress: true });
        // eslint-disable-next-line no-restricted-globals
        let certain = confirm(
            "Preparing to submit. Are you sure that your data are ready?"
        );
        if (certain) {
            let graph = this.graphlibToColocard(
                this.layers.traceManager.exportGraph()
            );
            return DB.postGraph(
                graph,
                this.volume._id,
                window.keycloak.profile.username
            ).then(status => {
                // TODO: Do not reload page if failed; instead,
                // show error to user
                return DB.updateQuestionStatus(this.questionId, status);
            }).then(() => {
                this.setState({
                    saveInProgress: true
                });
                return localForage.removeItem(
                    `breadcrumbsStorage-${this.questionId}`
                );
            }).then(() => {
                // eslint-disable-next-line no-restricted-globals
                location.reload(true);
            });
        } else {
            this.setState({
                saveInProgress: false
            });
        }
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
                                        {this.state.currentZ} / {this.layers.imageManager.images.length - 1}
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
                                secondary={true}
                                style={STYLES["save"]}
                                onClick={() => this.saveGraph()}
                                disabled={this.state.saveInProgress}>
                                <ContentSave />
                            </FloatingActionButton>
                            <FloatingActionButton
                                style={STYLES["submit"]}
                                onClick={() => this.submitGraph()}
                                disabled={this.state.saveInProgress}>
                                <ContentSend />
                            </FloatingActionButton>
                        </div>
                    </MuiThemeProvider>

                </div> : null}
            </div>
        );
    }
}
