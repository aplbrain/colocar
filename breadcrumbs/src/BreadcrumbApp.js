// @flow

import React, { Component } from "react";
import * as graphlib from "graphlib";
import uuidv4 from "uuid/v4";

import type { P5Type } from "colocorazon/dist/types/p5";
import CHash from "colocorazon/dist/colorhash";

import { Colocard } from "./db";
import ImageManager from "./layers/ImageManager";
import TraceManager from "./layers/TraceManager";
import Scrollbar from "./layers/Scrollbar";

import Avatar from "@material-ui/core/Avatar";
import Button from "@material-ui/core/Button";
import Chip from "@material-ui/core/Chip";
import Tooltip from "@material-ui/core/Tooltip";
import Snackbar from "@material-ui/core/Snackbar";

import InfoIcon from "@material-ui/icons/Info";
import SaveIcon from "@material-ui/icons/Save";
import SendIcon from "@material-ui/icons/Send";
import localForage from "localforage";

import "./BreadcrumbApp.css";
import BorderHighlight from "./layers/BorderHighlight";

let p5: P5Type = window.p5;

let DB = new Colocard();

const STYLES = {
    p5Container: {
        backgroundColor: "#808080",
        position:"fixed",
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
    nodeTypes: Array<Object>;
    layers: Object;
    // p: P5Type;
    renderOrder: Array<string>;

    state: {
        ready?: boolean,
        scale?: number,
        cursorX: number,
        cursorY: number,
        currentZ?: number,
        saveInProgress: boolean,
        instructions: Object
    };

    graphId: string;
    questionId: string;
    volume: Object;

    constructor(props: Object) {
        super(props);

        this.p5ID = "p5-container";
        this.state = {
            cursorX: 0,
            cursorY: 0,
            instructions: {},
            saveInProgress: false
        };

        // Create p5 sketch
        let self = this;
        self.sketch = (p: P5Type) => {
            p.setup = function() {
                let canvas = p.createCanvas(p.windowWidth, p.windowHeight);
                canvas.parent(self.p5ID);

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
                        throw new Error("failed to fetch question");
                    }
                    let question = res.question;
                    let colocardGraph = question.instructions.graph.structure;
                    let activeNodeId = question.instructions.activeNodeId;
                    let nodeTypes = question.instructions.type || [
                        { name: "presynaptic", key: "a", description: "Trace the presynaptic (axon) side of the marked synapse." },
                        { name: "postsynaptic", key: "d", description: "Trace the postsynaptic (dendrite) side of the marked synapse." },
                    ];
                    self.nodeTypes = nodeTypes;

                    let volume = res.volume;

                    self.graphId = question.instructions.graph._id;
                    self.questionId = question._id;
                    self.volume = volume;
                    let batchSize = 10;

                    let graphlibGraph = self.graphlibFromColocard(colocardGraph);

                    self.layers["imageManager"] = new ImageManager({
                        p,
                        volume,
                        batchSize
                    });

                    self.layers["borderHighlight"] = new BorderHighlight({
                        p,
                        imageManager: self.layers.imageManager
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
                        "imageManager",
                        "borderHighlight",
                        "traceManager",
                        "scrollbar"
                    ];

                    self.toggleOverlay();

                    self.setState({
                        ready: true,
                        scale: self.layers.imageManager.scale,
                        questionId: self.questionId,
                        currentZ: self.layers.imageManager.currentZ,
                        nodeCount: self.layers.traceManager.g.nodeCount(),
                        instructions: question.instructions,
                        snackbarOpen: true,
                    });

                    self.insertStoredGraph(graphlibGraph, activeNodeId);

                }).catch(err => alert(err));

            };

            p.windowResized = function() {
                p.resizeCanvas(p.windowWidth, p.windowHeight);
            };

            p.keyPressed = function() {

                // Check the instruction-specified keys first. Note that this
                // has the potential to break functionality if the assigning
                // instructions overwrite the normal behavior of the key!
                for (let nIndex = 0; nIndex < self.nodeTypes.length; nIndex++) {
                    if (p.key === self.nodeTypes[nIndex].key) {
                        self.markNodeType(self.nodeTypes[nIndex].name);
                    }
                }

                const eKey = 69;
                const hKey = 72;
                const oKey = 79;
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
                case oKey:
                    self.toggleOverlay();
                    break;
                case tKey:
                    self.toggleAnnotation();
                    break;
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
                self.updateUIStatus();
            };

            p.mouseMoved = function() {
                let im = self.layers.imageManager;
                if (im) {
                    self.setState({
                        cursorX: (p.mouseX - im.position.x)/im.scale,
                        cursorY:(p.mouseY - im.position.y)/im.scale
                    });
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
                self.updateUIStatus();
            };

            p.draw = function() {
                p.clear();
                // Draw every layer, in order:
                for (let layer of self.renderOrder) {
                    self.layers[layer].draw();
                }
            };
        };

        this.handleSnackbarClose = this.handleSnackbarClose.bind(this);
        this.handleSnackbarOpen = this.handleSnackbarOpen.bind(this);
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

    markNodeType(type: string): void {
        this.layers.traceManager.markNodeType(type);
    }

    stopHinting(): void {
        this.layers.traceManager.stopHinting();
    }

    toggleAnnotation(): void {
        this.layers.traceManager.toggleVisibility();
    }

    toggleOverlay(): void {
        this.layers.borderHighlight.toggleVisibility();
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

    insertStoredGraph(parentGraph: Object, activeNodeId: string) {
        this.setState({
            saveInProgress: true
        });
        localForage.getItem(
            `breadcrumbsStorage-${this.questionId}`
        ).then(storedData => {
            let storedGraph = graphlib.json.read(storedData.graphStr);
            this.layers.traceManager.insertCachedGraph(storedGraph, storedData.activeNodeId);
            this.setState({
                saveInProgress: false
            });
            this.reset();
            this.updateUIStatus();
        }).catch(() => {
            this.layers.traceManager.insertDownloadedGraph(parentGraph, activeNodeId);
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
                window.keycloak.profile.username,
                this.graphId,
                graph,
                this.volume._id
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
                    saveInProgress: true
                });
                return localForage.removeItem(
                    `breadcrumbsStorage-${this.questionId}`
                );
            }).then(() => {
                // eslint-disable-next-line no-restricted-globals
                location.reload(true);
            }).catch(err => {
                this.setState({
                    saveInProgress: false
                });
                alert(err);
            });
        } else {
            this.setState({
                saveInProgress: false
            });
        }
    }

    handleSnackbarClose() {
        this.setState({ snackbarOpen: false });
    }
    handleSnackbarOpen() {
        this.setState({ snackbarOpen: true });
    }

    render() {
        let chipHTML = [];
        let nodeTypes = this.state.instructions.type || [];
        let graph = this.layers? this.layers.traceManager.exportGraph(): null;
        let nodes = graph? graph.nodes().map(n => graph.node(n)): [];
        for (let nIndex = 0; nIndex < nodeTypes.length; nIndex++) {
            let n = nodeTypes[nIndex];
            let count = nodes.filter(node => node.type === n.name).length;
            chipHTML.push(
                <div key={n.key}>
                    <div style={{ float: "right" }}>
                        <Tooltip title={n.description}>
                            <Chip
                                style={{ margin: "0.5em 0" }}
                                label={`${n.name}: ${count}`}
                                avatar={
                                    <Avatar style={{ backgroundColor: CHash(n.name, 'hex') }}>{ n.key.toUpperCase() }</Avatar>
                                }
                            />
                        </Tooltip>
                    </div>
                </div>
            );
        }

        let oldX = this.state.cursorX;
        let oldY = this.state.cursorY;
        let oldZ = this.state.currentZ;
        let newX = 0;
        let newY = 0;
        let newZ = 0;

        if (this.volume && this.volume.bounds) {
            let xBounds = [this.volume.bounds[0][0], this.volume.bounds[1][0]];
            let yBounds = [this.volume.bounds[0][1], this.volume.bounds[1][1]];
            let zBounds = [this.volume.bounds[0][2], this.volume.bounds[1][2]];

            newX = Math.floor(oldX + xBounds[0] + (
                (xBounds[1] - xBounds[0]) / 2
            ));
            newY = Math.floor(oldY + yBounds[0] + (
                (yBounds[1] - yBounds[0]) / 2
            ));
            newZ = oldZ + zBounds[0];
        }

        let xString = String(newX).padStart(5, "0");
        let yString = String(newY).padStart(5, "0");
        let zString = String(newZ).padStart(5, "0");

        return (
            <div>
                <div id={this.p5ID} style={STYLES["p5Container"]}/>

                {this.state.ready ? <div>
                    <div>
                        <div style={{
                            position: "fixed",
                            right: 0,
                            top: 0,
                            margin: "2em"
                        }}>
                            { chipHTML }
                            <div style={{ float: "right", fontSize: "1.2em" }}>
                                <Chip
                                    style={{ margin: "0.5em 0" }}
                                    label={`x: ${xString}; y: ${yString}; z: ${zString}`}
                                />
                            </div>
                            <br/>
                            <div style={{ float: "right", fontSize: "0.9em" }}>
                                <Button style={{ opacity: 0.9 }}
                                    variant="fab"
                                    mini={true}
                                    onClick={ this.handleSnackbarOpen }
                                >
                                    <InfoIcon />
                                </Button>
                            </div>
                        </div>



                        <Snackbar
                            open={this.state.snackbarOpen}
                            onClose={this.handleSnackbarClose}
                            ContentProps={{
                                'aria-describedby': 'message-id',
                            }}
                            action={[
                                <Button key="undo" color="secondary" size="small" onClick={this.handleSnackbarClose}>
                                GOT IT
                                </Button>
                            ]}
                            message={<div id="message-id">
                                <div>{ this.state.instructions.prompt }</div>
                                <div>Task ID: {this.questionId}</div>
                            </div>}
                        />

                        <Button
                            variant="fab"
                            color="secondary"
                            style={STYLES["save"]}
                            onClick={() => this.saveGraph()}
                            disabled={this.state.saveInProgress}>
                            <SaveIcon />
                        </Button>
                        <Button
                            variant="fab"
                            color="primary"
                            style={STYLES["submit"]}
                            onClick={() => this.submitGraph()}
                            disabled={this.state.saveInProgress}>
                            <SendIcon />
                        </Button>
                    </div>

                </div> : null}
            </div>
        );
    }
}
