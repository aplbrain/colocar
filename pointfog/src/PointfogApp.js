// @flow

import React, { Component } from 'react';

import type { P5Type } from "colocorazon/dist/types/p5";
import CHash from "colocorazon/dist/colorhash";

import { Colocard } from "./db";
import ImageManager from "./layers/ImageManager";
import PointcloudManager from "./layers/PointcloudManager";
import Crosshairs from "./layers/Crosshairs";
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

import "./PointfogApp.css";

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
    nodeType: string;
    layers: Object;
    // p: P5Type;
    renderOrder: Array<string>;

    state: {
        ready?: boolean,
        scale?: number,
        currentZ?: number,
        nodeCount: number,
        saveInProgress: boolean,
        instructions: Object
    };

    questionId: string;
    volume: Object;

    constructor(props: Object) {
        super(props);

        this.p5ID = "p5-container";
        this.state = {
            nodeCount: 0,
            saveInProgress: false,
            instructions: {prompt: "", type: ""}
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

                // The layers that will be rendered in the p5 scene.
                self.layers = {};
                self.renderOrder = [];

                DB.getNextQuestion(
                    window.keycloak.profile.username,
                    DB.pointfog_name
                ).then((res: { question: Object, volume: Object }) => {
                    if (!res || !res.question) {
                        throw new Error("failed to fetch question");
                    }
                    let question = res.question;
                    let volume = res.volume;

                    self.questionId = question._id;
                    self.nodeType = question.instructions.type;
                    self.volume = volume;
                    let batchSize = 10;

                    self.layers["imageManager"] = new ImageManager({
                        p,
                        volume,
                        batchSize
                    });

                    self.layers["pointcloudManager"] = new PointcloudManager({
                        p,
                        imageManager: self.layers.imageManager
                    });

                    self.layers["crosshairs"] = new Crosshairs({
                        p,
                        imageManager: self.layers.imageManager
                    });

                    self.layers["scrollbar"] = new Scrollbar({
                        p,
                        imageManager: self.layers.imageManager,
                        pointcloudManager: self.layers.pointcloudManager,
                    });

                    // Set the order in which to render the layers. Removing layers
                    // from this array will cause them to not be rendered!
                    self.renderOrder = [
                        'imageManager',
                        'crosshairs',
                        'pointcloudManager',
                        'scrollbar'
                    ];

                    self.setState({
                        ready: true,
                        scale: self.layers.imageManager.scale,
                        questionId: self.questionId,
                        currentZ: self.layers.imageManager.currentZ,
                        instructions: question.instructions,
                        snackbarOpen: true
                    });
                    self.updateUIStatus();

                    self.insertStoredNodes();

                }).catch(err => alert(err));

            };

            p.windowResized = function() {
                p.resizeCanvas(p.windowWidth, p.windowHeight);
            };

            p.keyPressed = function() {
                const aKey = 65;
                const dKey = 68;
                const eKey = 69;
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
                const backspaceKey = 8;
                switch (p.keyCode) {
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
                    self.toggleCrossAndSyn();
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

            p.mouseWheel = function (e) {
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

        this.handleSnackbarClose = this.handleSnackbarClose.bind(this);
        this.handleSnackbarOpen = this.handleSnackbarOpen.bind(this);
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
                this.layers.pointcloudManager.addNode(node.id, node);
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

    toggleCrossAndSyn = function () {
        this.layers.crosshairs.toggleVisibility();
        this.layers.pointcloudManager.toggleVisibility();
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
        ).then(() => {
            this.setState({
                saveInProgress: false
            });
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
                newNode.type = this.nodeType || "synapse";
                newNode.volume = this.volume._id;

                return newNode;
            });
            return DB.postNodes(transformedNodes).then(status => {
                if (status === "completed") {
                    return DB.updateQuestionStatus(this.questionId, status);
                } else {
                    throw new Error("Failed to post - contact an admin.");
                }
            }).then(() => {
                this.setState({
                    saveInProgress: false
                });
                return localForage.removeItem(`pointfogStorage-${this.questionId}`);
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
        let prompt = this.state.instructions.prompt;
        let nodeType = this.state.instructions.type;
        let nodeKey = nodeType[0]? nodeType[0].toUpperCase(): "";
        let nodeCount = this.layers? this.layers.pointcloudManager.getNodes().length: 0;
        let chipHTML = (
            <div>
                <div style={{ float: "right" }}>
                    <Tooltip title={prompt}>
                        <Chip
                            style={{ margin: "0.5em 0" }}
                            label={`${nodeType}: ${nodeCount}`}
                            avatar={
                                <Avatar style={{ backgroundColor: CHash(nodeType, 'hex') }}>{ nodeKey }</Avatar>
                            }
                        />
                    </Tooltip>
                </div>
            </div>
        );
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
                            <div style={{ float: "right", fontSize: "0.9em" }}>
                                <br />
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
                                <div>{this.state.instructions.prompt}</div>
                                <div>Task ID: {this.questionId}</div>
                            </div>}
                        />

                        <Button
                            variant="fab"
                            color="secondary"
                            style={STYLES["save"]}
                            onClick={() => this.saveNodes()}
                            disabled={this.state.saveInProgress}>
                            <SaveIcon />
                        </Button>
                        <Button
                            variant="fab"
                            color="primary"
                            style={STYLES["submit"]}
                            onClick={() => this.submitNodes()}
                            disabled={this.state.saveInProgress}>
                            <SendIcon />
                        </Button>
                    </div>

                </div> : null}
            </div>
        );
    }
}
