// @flow

import React, { Component } from 'react';
import * as graphlib from "graphlib";
import uuidv4 from "uuid/v4";

import Chip from "@material-ui/core/Chip";
import Avatar from "@material-ui/core/Avatar";
import Tooltip from "@material-ui/core/Tooltip";

import type { P5Type } from "colocorazon/dist/types/p5Types";

import CHash from "colocorazon/dist/colorhash";
import { Colocard } from "colocorazon/dist/db";
import Scrollbar from "colocorazon/dist/layers/Scrollbar";

import ImageManager from "./layers/ImageManager";
import TraceManager from "./layers/TraceManager";

import "./MatchmakerApp.css";

let p5: P5Type = window.p5;

const APP_NAMESPACE = "matchmaker";

let DB = new Colocard({ namespace: APP_NAMESPACE });

const STYLES = {
    p5Container: {
        backgroundColor: "#808080",
        position: "fixed",
    },
    controlContainer: {
        position: "fixed",
        top: "15px",
        right: "15px",
        padding: "15px 15px 0 15px",
        userSelect: "none",
        // backgroundColor: "#FFF",
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
    graphLegendA: {
        backgroundColor: "rgb(90, 200, 90)",
        color: "white"

    },
    graphLegendB: {
        backgroundColor: "rgb(200, 90, 200)",
        color: "white"
    }
};

export default class MatchmakerApp extends Component<any, any> {

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
        cursorX: number,
        cursorY: number,
        cursorZ: number,
    };

    volume: Object;

    constructor(props: Object) {
        super(props);

        this.p5ID = "p5-container";
        this.state = {};

        // Create p5 sketch
        let self = this;
        self.sketch = (p: P5Type) => {
            p.setup = function () {
                let canvas = p.createCanvas(p.windowWidth, p.windowHeight);
                canvas.parent(self.p5ID);
                self.ghostLayer = p.createGraphics(p.width, p.height);

                canvas.mousePressed(function () {
                    self.layers.traceManagerA.mousePressed();
                    self.updateUIStatus();
                });

                // The layers that will be rendered in the p5 scene.
                self.layers = {};
                self.renderOrder = [];

                let getParams = window.location.search.split("&").map(i => i.split('=')[1]);
                let graphIdA;
                let graphIdB;

                if (getParams.length === 2) {
                    graphIdA = getParams[0];
                    graphIdB = getParams[1];
                }

                while (!graphIdA) {
                    graphIdA = window.prompt("Enter first graph id.");
                }
                while (!graphIdB) {
                    graphIdB = window.prompt("Enter second graph id.");
                }

                DB.getTwoGraphsAndVolume(
                    graphIdA,
                    graphIdB
                ).then((res: { graphA: Object, graphB: Object, volume: Object }) => {
                    if (!res) {
                        throw new Error("failed to fetch question");
                    }
                    let colocardGraphA = res.graphA;
                    let colocardGraphB = res.graphB;
                    let volume = res.volume;

                    self.volume = volume;
                    let batchSize = 10;

                    let graphlibGraphA = self.graphlibFromColocard(colocardGraphA);
                    let graphlibGraphB = self.graphlibFromColocard(colocardGraphB);
                    graphlibGraphA.author = colocardGraphA.author;
                    graphlibGraphB.author = colocardGraphB.author;

                    self.layers["imageManager"] = new ImageManager({
                        p,
                        volume,
                        batchSize
                    });

                    self.layers["traceManagerA"] = new TraceManager({
                        p,
                        imageManager: self.layers.imageManager,
                        startingGraph: null
                    });

                    self.layers["traceManagerB"] = new TraceManager({
                        p,
                        imageManager: self.layers.imageManager,
                        startingGraph: null,
                        DEFAULT_COLOR: { r: 200, g: 90, b: 200 },
                        EDGE_COLOR: { r: 170, g: 60, b: 170 }
                    });

                    self.layers["scrollbar"] = new Scrollbar({
                        p,
                        imageManager: self.layers.imageManager,
                        entityLayers: [self.layers.traceManagerA, self.layers.traceManagerB]
                    });

                    // Set the order in which to render the layers. Removing layers
                    // from this array will cause them to not be rendered!
                    self.renderOrder = [
                        'imageManager',
                        'traceManagerA',
                        'traceManagerB',
                        'scrollbar'
                    ];

                    self.setState({
                        ready: true,
                        scale: self.layers.imageManager.scale,
                        currentZ: self.layers.imageManager.currentZ,
                        nodeCount: self.layers.traceManagerA.g.nodeCount(),
                        nodeTypes: []
                    });

                    self.layers.traceManagerA.insertGraph(graphlibGraphA);
                    self.layers.traceManagerB.insertGraph(graphlibGraphB);
                    self.reset();
                    self.updateUIStatus();

                }).catch(err => alert(err));

            };

            p.windowResized = function () {
                p.resizeCanvas(p.windowWidth, p.windowHeight);
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

            p.keyPressed = function () {
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
                        self.toggleTraceVisibility();
                        break;
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
            };

            p.mouseWheel = function (e) {
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

            p.draw = function () {
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
            nodeCountA: this.layers.traceManagerA.g.nodes().length,
            nodeTypes: Array.from(new Set([
                ...this.layers.traceManagerA.nodeTypes,
                ...this.layers.traceManagerB.nodeTypes
            ]))
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
        this.setState({ currentZ: this.layers.imageManager.currentZ });
    }

    decrementZ(): void {
        this.layers.imageManager.decrementZ();
        this.setState({ currentZ: this.layers.imageManager.currentZ });
    }

    reset(): void {
        let curZ = this.layers.traceManagerA.getSelectedNodeZ();
        this.layers.imageManager.reset(curZ);
        this.setState({
            scale: this.layers.imageManager.scale,
            currentZ: curZ
        });
    }

    toggleTraceVisibility(): void {
        this.layers.traceManagerA.toggleVisibility();
        this.layers.traceManagerB.toggleVisibility();
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
            newNode.namespace = APP_NAMESPACE;
            newNode.type = oldNode.type;
            newNode.lowConfidence = oldNode.metadata ? oldNode.metadata.lowConfidence : false;
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

    render() {
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
                <div id={this.p5ID} style={STYLES["p5Container"]} />

                {this.state.ready ? <div style={STYLES["controlContainer"]}>
                    <div style={{ float: "right", width: "100%" }}>
                        <Tooltip title={this.layers.traceManagerA.g.author}>
                            <Chip
                                style={{ margin: "0.5em 0" }}
                                label={this.layers.traceManagerA.g.author}
                                avatar={
                                    <Avatar style={STYLES["graphLegendA"]}></Avatar>
                                }
                            />
                        </Tooltip>
                    </div>
                    <br />
                    <div style={{ float: "right", width: "100%" }}>
                        <Tooltip title={this.layers.traceManagerB.g.author}>
                            <Chip
                                style={{ margin: "0.5em 0" }}
                                label={this.layers.traceManagerB.g.author}
                                avatar={
                                    <Avatar style={STYLES["graphLegendB"]}></Avatar>
                                }
                            />
                        </Tooltip>
                    </div>
                    <br />
                    {
                        this.state.nodeTypes.map(type => (
                            <div key={type}>
                                <div style={{ float: "right", width: "100%" }}>
                                    <Tooltip title={type}>
                                        <Chip
                                            style={{ margin: "0.5em 0" }}
                                            label={`${type}`}
                                            avatar={
                                                <Avatar style={{ backgroundColor: CHash(type, 'hex') }}>{type[0].toUpperCase()}</Avatar>
                                            }
                                        />
                                    </Tooltip>
                                </div>
                            </div>
                        ))
                    }
                    <div style={{ "position": "relative" }}>
                        <div style={{ float: "right", fontSize: "1.2em" }}>
                            <Chip
                                style={{ margin: "0.5em 0" }}
                                label={`x: ${xString}; y: ${yString}; z: ${zString}`}
                            />
                        </div>
                    </div>

                </div> : null}
            </div>
        );
    }
}
