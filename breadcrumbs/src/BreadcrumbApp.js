// @flow

import React, { Component } from "react";
import * as graphlib from "graphlib";
import uuidv4 from "uuid/v4";

import type { P5Type } from "colocorazon/dist/types/p5";
import CHash from "colocorazon/dist/colorhash";
import { Colocard } from "colocorazon/dist/db";
import Scrollbar from "colocorazon/dist/layers/Scrollbar";

import ImageManager from "./layers/ImageManager";
import TraceManager from "./layers/TraceManager";
import BorderHighlight from "./layers/BorderHighlight";

import Avatar from "@material-ui/core/Avatar";
import Button from "@material-ui/core/Button";
import Checkbox from "@material-ui/core/Checkbox";
import Chip from "@material-ui/core/Chip";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Snackbar from "@material-ui/core/Snackbar";
import Tooltip from "@material-ui/core/Tooltip";

import FeedbackIcon from "@material-ui/icons/Feedback";
import InfoIcon from "@material-ui/icons/Info";
import LibraryBooksIcon from "@material-ui/icons/LibraryBooks";
import SaveIcon from "@material-ui/icons/Save";
import SendIcon from "@material-ui/icons/Send";
import localForage from "localforage";

import "./BreadcrumbApp.css";

let p5: P5Type = window.p5;

let DB = new Colocard({
    namespace: "breadcrumbs"
});

const STYLES = {
    p5Container: {
        backgroundColor: "#808080",
        position: "fixed",
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

const BATCH_SIZE = 10;

const DEFAULT_NODE_TYPES = [
    { name: "presynaptic", key: "a", description: "Trace the presynaptic (axon) side of the marked synapse." },
    { name: "postsynaptic", key: "d", description: "Trace the postsynaptic (dendrite) side of the marked synapse." },
];

const DEFAULT_ARTIFACT_TAGS = [
    "cracked",
    "dropped",
    "folded",
    "imaging",
    "stained"
];

const APP_NAMESPACE = "breadcrumbs";

export default class BreadcrumbApp extends Component<any, any> {

    artifacts: Object;
    artifactImageUrls: Object;
    artifactFlag: boolean;
    artifactTags: Array<string>;
    canvas: Object;
    confidence: boolean;
    graphId: string;
    p5ID: string;
    sketch: any;
    nodeTypes: Array<Object>;
    layers: Object;
    nodeTypes: Array<Object>;
    p5ID: string;
    prompt: string;
    questionId: string;
    renderOrder: Array<string>;
    sketch: any;
    volume: Object;

    state: {
        artifactModalOpen: boolean,
        artifactReportOpen: boolean,
        cursorX: number,
        cursorY: number,
        cursorZ?: number,
        ready?: boolean,
        saveInProgress: boolean,
        scale?: number
    };

    constructor(props: Object) {
        super(props);

        this.p5ID = "p5-container";
        this.state = {
            artifactModalOpen: false,
            artifactReportOpen: false,
            cursorX: 0,
            cursorY: 0,
            saveInProgress: false
        };

        // Create p5 sketch
        let self = this;
        self.sketch = (p: P5Type) => {
            p.setup = function () {
                let canvas = p.createCanvas(p.windowWidth, p.windowHeight);
                canvas.parent(self.p5ID);

                canvas.mousePressed(function () {
                    if (self.layers.scrollbar.mousePressed()) {
                        self.layers.traceManager.mousePressed();
                    }
                    self.updateUIStatus();
                });

                canvas.mouseClicked(function () {
                    self.layers.traceManager.mouseClicked();
                    self.updateUIStatus();
                });

                self.canvas = canvas;

                // The layers that will be rendered in the p5 scene.
                self.layers = {};
                self.renderOrder = [];

                DB.getNextQuestion(
                    window.keycloak.profile.username,
                    APP_NAMESPACE
                ).then((res: { question: Object, volume: Object }) => {
                    if (!res || !res.question) {
                        throw new Error("failed to fetch question");
                    }

                    let instructions = res.question.instructions;
                    self.questionId = res.question._id;
                    self.volume = res.volume;

                    self.artifactFlag = instructions.artifact;
                    self.artifactTags = instructions.artifactTags || DEFAULT_ARTIFACT_TAGS;
                    self.confidence = instructions.confidence || false;
                    self.graphId = instructions.graph._id;
                    self.nodeTypes = instructions.type || DEFAULT_NODE_TYPES;
                    self.prompt = instructions.prompt;

                    let activeNodeId = instructions.activeNodeId;
                    let colocardGraph = instructions.graph.structure;
                    let emptyArtifacts = self.getEmptyArtifacts(self.artifactTags);
                    self.artifacts = emptyArtifacts;
                    self.artifactImageUrls = {};

                    let graphlibGraph = self.graphlibFromColocard(colocardGraph);

                    self.layers["imageManager"] = new ImageManager({
                        p,
                        batchSize: BATCH_SIZE,
                        volume: self.volume
                    });

                    self.layers["borderHighlight"] = new BorderHighlight({
                        p,
                        imageManager: self.layers.imageManager
                    });

                    self.layers["traceManager"] = new TraceManager({
                        p,
                        imageManager: self.layers.imageManager,
                        startingGraph: null,
                        allowDisconnected: res.question.instructions.allowDisconnected
                    });

                    self.layers["scrollbar"] = new Scrollbar({
                        p,
                        imageManager: self.layers.imageManager,
                        entityLayers: [self.layers.traceManager],
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
                        cursorZ: self.layers.imageManager.currentZ,
                        nodeCount: self.layers.traceManager.g.nodeCount(),
                        questionId: self.questionId,
                        ready: true,
                        scale: self.layers.imageManager.scale,
                        snackbarOpen: true,
                    });

                    self.insertStoredGraph(graphlibGraph, activeNodeId);

                }).catch(err => alert(err));

            };

            p.windowResized = function () {
                p.resizeCanvas(p.windowWidth, p.windowHeight);
            };

            p.keyPressed = function () {

                // Check the instruction-specified keys first. Note that this
                // has the potential to break functionality if the assigning
                // instructions overwrite the normal behavior of the key!
                for (let nIndex = 0; nIndex < self.nodeTypes.length; nIndex++) {
                    if (p.key === self.nodeTypes[nIndex].key) {
                        self.markNodeType(self.nodeTypes[nIndex].name);
                    }
                }

                const cKey = 67;
                const eKey = 69;
                const hKey = 72;
                const oKey = 79;
                const qKey = 81;
                const tKey = 84;
                const xKey = 88;
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
                    case cKey:
                        if (self.confidence) {
                            self.markLowConfidence();
                        }
                        break;
                    case exclamationKey:
                        self.markBookmark();
                        break;
                    case atSignKey:
                        self.popBookmark();
                        break;
                    // deletion
                    case xKey:
                    case backspaceKey:
                        self.deleteActiveNode();
                        return false;
                    default:
                        break;
                }

                self.updateUIStatus();
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
                self.updateUIStatus();
            };

            p.mouseMoved = function () {
                let im = self.layers.imageManager;
                if (im) {
                    self.setState({
                        cursorX: (p.mouseX - im.position.x) / im.scale,
                        cursorY: (p.mouseY - im.position.y) / im.scale
                    });
                }
            };

            p.mouseWheel = function (e) {
                let delta = 0;
                if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                    delta = e.deltaX;
                } else {
                    delta = e.deltaY;
                }
                // Handle pinch-to-zoom functionality
                if (!self.state.artifactReportOpen) {
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
                    self.updateUIStatus();
                }
            };

            p.draw = function () {
                p.clear();
                // Draw every layer, in order:
                for (let layer of self.renderOrder) {
                    self.layers[layer].draw();
                }
            };
        };

        this.handleMetadataModalClose = this.handleMetadataModalClose.bind(this);
        this.handleMetadataModalOpen = this.handleMetadataModalOpen.bind(this);

        this.handleArtifactReportClose = this.handleArtifactReportClose.bind(this);
        this.handleArtifactReportOpen = this.handleArtifactReportOpen.bind(this);

        this.handleSnackbarClose = this.handleSnackbarClose.bind(this);
        this.handleSnackbarOpen = this.handleSnackbarOpen.bind(this);
    }

    updateUIStatus(): void {
        this.setState({
            cursorZ: this.layers.imageManager.currentZ,
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
        this.setState({ scale: this.layers.imageManager.scale });
    }

    scaleDown(): void {
        this.layers.imageManager.scaleDown();
        this.setState({ scale: this.layers.imageManager.scale });
    }

    incrementZ(): void {
        this.layers.imageManager.incrementZ();
        this.handleMetadataModalClose();
        this.setState({ cursorZ: this.layers.imageManager.currentZ });
    }

    decrementZ(): void {
        this.layers.imageManager.decrementZ();
        this.handleMetadataModalClose();
        this.setState({ cursorZ: this.layers.imageManager.currentZ });
    }

    reset(): void {
        let curZ = this.layers.traceManager.getSelectedNodeZ();
        this.layers.imageManager.reset(curZ);
        this.setState({
            cursorZ: curZ,
            scale: this.layers.imageManager.scale
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

    markLowConfidence(): void {
        this.layers.traceManager.markLowConfidence();
    }

    markBookmark(): void {
        this.layers.traceManager.markBookmark();
    }
    popBookmark(): void {
        // eslint-disable-next-line no-unused-vars
        let { x, y, z } = this.layers.traceManager.popBookmark();
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
            this.artifacts = storedData.artifacts;
            this.artifactImageUrls = storedData.artifactImageUrls || {};
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
        let artifacts = this.artifacts;
        let artifactImageUrls = this.artifactImageUrls;
        let graphStr = graphlib.json.write(this.layers.traceManager.g);
        let activeNodeId = this.layers.traceManager.activeNode ? (
            // fallback in case there is no active node (see #260)
            this.layers.traceManager.activeNode.id || this.layers.traceManager.activeNode._id
        ) : undefined;
        localForage.setItem(
            `breadcrumbsStorage-${this.questionId}`,
            {
                artifacts,
                artifactImageUrls,
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
            newNode.namespace = APP_NAMESPACE;
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
            newNode.metadata = oldNode.lowConfidence ? { "lowConfidence": true } : {};
            newNode.namespace = APP_NAMESPACE;
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
            let graphPromise = DB.postGraph(
                window.keycloak.profile.username,
                this.graphId,
                graph,
                this.volume._id
            );
            let artifactPromise = DB.postArtifacts(
                this.questionId,
                this.artifacts
            );
            Promise.all([graphPromise, artifactPromise]).then(results => {
                let status = results[0];
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

    handleMetadataModalClose() {
        this.setState({ artifactModalOpen: false });
    }
    handleMetadataModalOpen() {
        this.setState({ artifactModalOpen: true });
    }

    handleArtifactReportClose() {
        this.setState({ artifactReportOpen: false });
    }

    handleArtifactReportOpen() {
        this.setState({ artifactReportOpen: true });
    }

    handleSnackbarClose() {
        this.setState({ snackbarOpen: false });
    }
    handleSnackbarOpen() {
        this.setState({ snackbarOpen: true });
    }

    getEmptyArtifacts(artifactTags: Array<string>): Object {
        let emptyArtifacts = {};
        for (let aIndex = 0; aIndex < artifactTags.length; aIndex++) {
            emptyArtifacts[artifactTags[aIndex]] = {};
        }
        return emptyArtifacts;
    }

    render() {
        let chipHTML = [];
        this.nodeTypes = this.nodeTypes || DEFAULT_NODE_TYPES;
        let graph = this.layers ? this.layers.traceManager.exportGraph() : null;
        let nodes = graph ? graph.nodes().map(n => graph.node(n)) : [];
        for (let nIndex = 0; nIndex < this.nodeTypes.length; nIndex++) {
            let n = this.nodeTypes[nIndex];
            let count = nodes.filter(node => node.type === n.name).length;
            chipHTML.push(
                <div key={n.key}>
                    <div style={{ float: "right" }}>
                        <Tooltip title={n.description}>
                            <Chip
                                style={{ margin: "0.5em 0" }}
                                label={`${n.name}: ${count}`}
                                avatar={
                                    <Avatar style={{ backgroundColor: CHash(n.name, 'hex') }}>{n.key.toUpperCase()}</Avatar>
                                }
                            />
                        </Tooltip>
                    </div>
                </div>
            );
        }
        if (this.confidence) {
            chipHTML.push(
                <div>
                    <div style={{ float: "right" }}>
                        <Tooltip title={"Mark nodes as being low-confidence."}>
                            <Chip
                                style={{ margin: "0.5em 0" }}
                                label={"confidence"}
                                avatar={
                                    <Avatar style={{ backgroundColor: "white" }}>{"C"}</Avatar>
                                }
                            />
                        </Tooltip>
                    </div>
                </div>
            );
        }

        let oldX = this.state.cursorX;
        let oldY = this.state.cursorY;
        let oldZ = this.state.cursorZ;
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

        let artifactButtonColor = "default";
        let artifactChecklistHTML = [];
        let artifactSnapshotTitle = [];
        let artifactSnapshots = [];
        let jpegQuality = 0.5;

        if (this.artifactFlag) {
            // this initialization currently must happen in both
            // the constructor and render method - switching to
            // state-based variables may help
            this.artifactTags = this.artifactTags || DEFAULT_ARTIFACT_TAGS;
            let emptyArtifacts = this.getEmptyArtifacts(this.artifactTags);
            this.artifacts = this.artifacts || emptyArtifacts;
            this.artifactImageUrls = this.artifactImageUrls || {};
            for (let aIndex = 0; aIndex < this.artifactTags.length; aIndex++) {
                let artifact = this.artifactTags[aIndex];
                artifactChecklistHTML.push(
                    <DialogContent key={`artifact_${artifact}`}>
                        <Checkbox
                            checked={this.artifacts[artifact][newZ]}
                            onChange={(event: Object, checked: boolean) => {
                                this.artifacts[artifact][newZ] = checked;
                                if (checked === true) {
                                    if (!(newZ in this.artifactImageUrls)) {
                                        this.artifactImageUrls[newZ] = this.layers.imageManager.p.canvas.toDataURL("image/jpeg", jpegQuality);
                                    }
                                } else {
                                    let noneFlag = true;
                                    for (let aIndex = 0; aIndex < emptyArtifacts.length; aIndex++) {
                                        noneFlag &= !this.artifacts[aIndex][newZ];
                                    }
                                    if (noneFlag) {
                                        delete this.artifactImageUrls[newZ];
                                    }
                                }
                            }} />
                        <span>{artifact}</span>
                    </DialogContent>
                );
                if (this.artifacts[artifact][newZ] === true) {
                    artifactButtonColor = "secondary";
                }
            }
            for (let zIndex in this.artifactImageUrls) {
                artifactSnapshots.push(
                    <tr
                        key={`artifact_snapshot_${zIndex}`}
                    >
                        <td
                            style={{ "padding": "2%" }}
                        >
                            <img
                                alt="em-snapshot"
                                src={this.artifactImageUrls[zIndex]}
                                width="100%"
                            />
                        </td>
                        <td
                            style={{ "padding": "2%" }}
                        >
                            z-index: {zIndex}
                            <br />
                            {this.artifactTags.filter(aTag => this.artifacts[aTag][zIndex]).join("/")}
                        </td>
                    </tr>
                );
            }
            artifactSnapshotTitle.push(
                <tr
                    key={`artifact_snapshot_title`}
                >
                    {`Images with Tagged Artifacts: ${artifactSnapshots.length}`}
                </tr>
            );
        }

        return (
            <div>
                <div id={this.p5ID} style={STYLES["p5Container"]} />

                {this.state.ready ? <div>
                    <div>
                        <div style={{
                            position: "fixed",
                            right: 0,
                            top: 0,
                            margin: "2em"
                        }}>
                            {chipHTML}
                            <div style={{ "position": "relative" }}>
                                <div style={{ float: "right", fontSize: "1.2em" }}>
                                    <Chip
                                        style={{ margin: "0.5em 0" }}
                                        label={`x: ${xString}; y: ${yString}; z: ${zString}`}
                                    />
                                </div>
                            </div>
                            <div style={{ "float": "right" }}>
                                <div style={{ fontSize: "0.9em", marginBottom: "0.25em" }}>
                                    <Button style={{ opacity: 0.9 }}
                                        variant="fab"
                                        mini={true}
                                        onClick={this.handleSnackbarOpen}
                                    >
                                        <InfoIcon />
                                    </Button>
                                </div>
                                {this.artifactFlag ? (
                                    <div style={{ fontSize: "0.9em" }}>
                                        <Button style={{ opacity: 0.9 }}
                                            color={artifactButtonColor}
                                            variant="fab"
                                            mini={true}
                                            onClick={this.handleMetadataModalOpen}
                                        >
                                            <FeedbackIcon />
                                        </Button>
                                    </div>
                                ) : ""}
                                {this.artifactFlag ? (
                                    <div style={{ fontSize: "0.9em" }}>
                                        <Button style={{ opacity: 0.9 }}
                                            variant="fab"
                                            mini={true}
                                            onClick={this.handleArtifactReportOpen}
                                        >
                                            <LibraryBooksIcon />
                                        </Button>
                                    </div>
                                ) : ""}
                            </div>
                        </div>

                        <Dialog
                            id="artifact-annotation"
                            open={this.state.artifactModalOpen}
                            onClose={this.handleMetadataModalClose}
                        >
                            <DialogTitle>
                                Slice Artifacts: z={newZ}
                            </DialogTitle>
                            {artifactChecklistHTML}
                        </Dialog>

                        <Dialog
                            id="artifact-report"
                            open={this.state.artifactReportOpen}
                            onClose={this.handleArtifactReportClose}
                        >
                            <table>
                                <tbody>
                                    {artifactSnapshotTitle}
                                    {artifactSnapshots}
                                </tbody>
                            </table>
                        </Dialog>

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
                                <div>{this.prompt}</div>
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
