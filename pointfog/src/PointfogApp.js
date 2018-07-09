// @flow

import React, { Component } from 'react';

import type { P5Type } from "./types/p5Types";

import { Colocard } from "./db";
import ImageManager from "./layers/ImageManager";
import PointcloudManager from "./layers/PointcloudManager";
import Crosshairs from "./layers/Crosshairs";
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider'
import FloatingActionButton from "material-ui/FloatingActionButton";
import ContentSend from "material-ui/svg-icons/content/send";
import ContentSave from "material-ui/svg-icons/content/save";
import localForage from "localforage";

import "./PointfogApp.css";

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
    save: {
        position: "fixed",
        left: "2em",
        bottom: "2em",
    },
    submit: {
        position: "fixed",
        right: "2em",
        bottom: "2em"
    },
};

export default class PointfogApp extends Component<any, any> {

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
        nodeCount: number,
        saveInProgress: boolean
    };

    questionId: string;
    volume: Object;

    constructor(props: Object) {
        super(props);

        this.p5ID = "p5-container";
        this.state = {
            nodeCount: 0,
            saveInProgress: false,
        };

        // Create p5 sketch
        let self = this;
        self.sketch = (p: P5Type) => {
            p.setup = function() {
                let canvas = p.createCanvas(p.windowWidth, p.windowHeight);
                canvas.parent(self.p5ID);

                canvas.mousePressed(function() {
                    self.layers.pointcloudManager.mousePressed();
                    self.updateUIStatus();
                });

                canvas.mouseClicked(function() {
                    self.layers.pointcloudManager.mouseClicked();
                    self.updateUIStatus();
                });

                self.ghostLayer = p.createGraphics(p.width, p.height);

                // The layers that will be rendered in the p5 scene.
                self.layers = {};
                self.renderOrder = [];

                DB.getNextQuestion(
                    window.keycloak.profile.username,
                    DB.pointfog_name
                ).then((res: { question: Object, volume: Object }) => {
                    if (!res || !res.question) {
                        alert("No remaining questions.");
                        return;
                    }
                    let question = res.question;
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
                        return `https://api.theboss.io/v1/image/${volume.collection}/${volume.experiment}/${volume.channel}/xy/0/${xBounds[0]}:${xBounds[1]}/${yBounds[0]}:${yBounds[1]}/${_z}/?no-cache=true`;
                    });

                    self.layers["imageManager"] = new ImageManager({
                        p,
                        imageURIs,
                    });

                    self.layers["pointcloudManager"] = new PointcloudManager({
                        p,
                        imageManager: self.layers.imageManager
                    });

                    self.layers["crosshairs"] = new Crosshairs({
                        p,
                        imageManager: self.layers.imageManager
                    });

                    // Set the order in which to render the layers. Removing layers
                    // from this array will cause them to not be rendered!
                    self.renderOrder = [
                        'imageManager',
                        'crosshairs',
                        'pointcloudManager',
                    ];

                    self.setState({
                        ready: true,
                        scale: self.layers.imageManager.scale,
                        questionId: question._id,
                        currentZ: self.layers.imageManager.currentZ,
                    });
                    self.updateUIStatus();

                    self.insertStoredNodes();

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
                case 38:
                    // "w" or up arrow is pressed
                    self.panDown();
                    break;
                case 83:
                case 115:
                case 40:
                    // "s" or down arrow is pressed
                    self.panUp();
                    break;
                case 97:
                case 37:
                    // left arrow is pressed
                    self.panRight();
                    break;
                case 100:
                case 39:
                    // "d" or right arrow is pressed
                    self.panLeft();
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
                // case 49:
                //     self.markBookmark();
                //     break;
                // case 50:
                //     self.popBookmark();
                //     break;
                case 84: // T
                    self.toggleCrosshairs();
                    break;
                default:
                    break;
                }
                self.updateUIStatus();
            };

            p.mouseWheel = function (e) {
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

            p.mouseDragged = function () {
                if (p.mouseButton === p.RIGHT) {
                    // Only drag the image if mouse is in the image.
                    if (self.layers.imageManager.imageCollision(p.mouseX, p.mouseY)) {
                        let dX = p.pmouseX - p.mouseX;
                        let dY = p.pmouseY - p.mouseY;

                        self.layers.imageManager.setPosition(self.layers.imageManager.position.x - dX, self.layers.imageManager.position.y - dY);
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

    insertStoredNodes() {
        localForage.getItem(`pointfogStorage-${this.questionId}`).then(nodes => {
            nodes = nodes || [];
            nodes.forEach(node => {
                this.layers.pointcloudManager.addNode(node.id, node)
            });
            this.layers.pointcloudManager.selectedNode = nodes.slice(-1)[0];
            this.updateUIStatus();
        });
    }

    reset(): void {
        this.layers.imageManager.reset();
        this.setState({
            scale: this.layers.imageManager.scale,
            currentZ: this.layers.imageManager.currentZ,
        });
    }

    toggleCrosshairs = function () {
        this.layers.crosshairs.toggleVisibility();
    };

    deleteActiveNode(): void {
        this.layers.pointcloudManager.deleteActiveNode();
    }

    componentDidMount() {
        new p5(this.sketch);
    }

    updateUIStatus(): void {
        this.setState({
            nodeCount: this.layers.pointcloudManager.nodes.length
        });
    }

    saveNodes() {
        /*
        Save nodes to a localforage cache
        */
        this.setState({
            saveInProgress: true
        });
        let nodes = this.layers.pointcloudManager.getNodes();
        localForage.setItem(
            `pointfogStorage-${this.questionId}`,
            nodes,
        ).then((savedSynapses, errorSaving) => {
            this.setState({
                saveInProgress: false
            });
            console.log("saved nodes!");
        });
    }

    submitNodes() {
        /*
        Submit the Nodes to the database
        */
        this.setState({
            saveInProgress: true
        });
        // eslint-disable-next-line no-restricted-globals
        let certain = confirm("Attempting to submit. Are you sure that your data are ready?");
        console.log(certain);
        if (certain) {
            let xBounds = [this.volume.bounds[0][0], this.volume.bounds[1][0]];
            let yBounds = [this.volume.bounds[0][1], this.volume.bounds[1][1]];
            let zBounds = [this.volume.bounds[0][2], this.volume.bounds[1][2]];
            let nodes = this.layers.pointcloudManager.getNodes();
            let transformedNodes = nodes.map(oldNode => {
                let newNode: Node = {};
                // Rescale the node centroids to align with data-space, not p5 space:
                let newX = oldNode.x + xBounds[0] + (
                    (xBounds[1] - xBounds[0])/2
                );
                let newY = oldNode.y + yBounds[0] + (
                    (yBounds[1] - yBounds[0])/2
                );
                let newZ = oldNode.z + zBounds[0];

                newNode.author = window.keycloak.profile.username;
                newNode.coordinate = [newX, newY, newZ];
                newNode.created = oldNode.created;
                newNode.namespace = DB.pointfog_name;
                newNode.type = "synapse";
                newNode.volume = this.volume._id;

                return newNode;
            });
            return DB.postNodes(transformedNodes).then(status => {
                return DB.updateQuestionStatus(this.questionId, status);
            }).then(() => {
                this.setState({
                    saveInProgress: false
                });
                return localForage.removeItem(`pointfogStorage-${this.questionId}`);
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
                        <tr>
                            <td>
                                <div style={STYLES["controlLabel"]}>Zoom</div>
                            </td>
                            <td>
                                <div style={STYLES["controlToolInline"]}>
                                    <button onClick={
                                        ()=>this.scaleDown()
                                    }>-</button>
                                    {Math.round(100 * this.state.scale)}%
                                    <button onClick={()=>{this.scaleUp()}}>+</button>
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
                                    {this.state.currentZ + 1} / {this.layers.imageManager.images.length}
                                    <button onClick={()=>this.incrementZ()}>+</button>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td style={STYLES["controlRow"]}>
                                <div style={STYLES["controlLabel"]}>Nodes</div>
                                <div style={STYLES["controlToolInline"]}>
                                    {this.state.nodeCount}
                                </div>
                            </td>
                        </tr>

                        <tr>
                            <td colSpan={2}>
                                <small>
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
                    </table>

                    <MuiThemeProvider>
                        <div>
                            <FloatingActionButton
                                style={STYLES["submit"]}
                                onClick={() => this.submitNodes()}
                                disabled={this.state.saveInProgress}>
                                <ContentSend />
                            </FloatingActionButton>
                            <FloatingActionButton
                                secondary={true}
                                style={STYLES["save"]}
                                onClick={() => this.saveNodes()}
                                disabled={this.state.saveInProgress}>
                                <ContentSave />
                            </FloatingActionButton>
                        </div>
                    </MuiThemeProvider>

                </div> : null}
            </div>
        );
    }
}
