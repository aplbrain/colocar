// @flow

import React, { Component } from 'react';
import * as graphlib from "graphlib";


import type { P5Type } from "./types/p5Types";

import { Colocard } from "./db";
import ImageManager from "./layers/ImageManager";
import TraceManager from "./layers/TraceManager";
import Scrollbar from "./layers/Scrollbar";
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
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
                    let startingGraph = question.instructions.graph;
                    let volume = res.volume;
                    console.log(question);
                    console.log(volume);

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
                                id: startingSynapse._id || startingSynapse.id,
                                x: synapseRemappedPosition.x,
                                y: synapseRemappedPosition.y,
                                z: synapseRemappedPosition.z,
                                protected: true
                            }]
                        },
                        activeNodeId: startingSynapse._id || startingSynapse.id
                    });

                    self.layers["scrollbar"] = new Scrollbar({
                        p,
                        imageManager: self.layers.imageManager
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
                        nodeCount: self.layers.traceManager.g.nodes().length
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
                case 72:  // H cancels hinting
                    self.stopHinting();
                    break;
                case 84:  // T toggles trace visibility
                    self.toggleTraceVisibility();
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
            // currentZ: this.layers.imageManager.currentZ,
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

    remapGraph(graph: Object) {
        let xBounds = [this.volume.bounds[0][0], this.volume.bounds[1][0]];
        let yBounds = [this.volume.bounds[0][1], this.volume.bounds[1][1]];
        let zBounds = [this.volume.bounds[0][2], this.volume.bounds[1][2]];
        let mappedNodes = graph.nodes().map(n => graph.node(n)).map(oldNode => {
            let newNode: Node = {};
            // Rescale the node centroids to align with data-space, not p5 space:
            let newX = oldNode.x + xBounds[0] + (
                (xBounds[1] - xBounds[0]) / 2
            );
            let newY = oldNode.y + yBounds[0] + (
                (yBounds[1] - yBounds[0]) / 2
            );
            let newZ = oldNode.z + zBounds[0];

            newNode.author = window.keycloak.profile.username;
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
            let graph = this.remapGraph(
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
                                    <small><code>
                                        {
                                            this.questionId || ""
                                        }
                                    </code></small>
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
