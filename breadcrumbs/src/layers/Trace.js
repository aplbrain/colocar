// @flow

import * as graphlib from "graphlib";
import uuidv4 from "uuid/v4";

import type { P5Type } from "../types/p5";

import {
    LINE_COLOR
} from "../colors";


class Node {

    id: string;
    // Dataspace Position
    x: number;
    y: number;
    z: number;

    // UIspace position
    screenX: number;
    screenY: number;

    created: ?Date;
    author: ?string;

    constructor(opts) {
        this.x = opts.x;
        this.y = opts.y;
        this.z = opts.z;
        this.screenX = opts.screenX;
        this.screenY = opts.screenY;
        this.created = opts.created || new Date();
        this.author = opts.author || undefined;
        this.id = opts.id || uuidv4();
    }
};

type Edge = {

    x: number,
    y: number,
    z: number,

    created: ?Date,
    author: ?string

};


class GraphManager {
    /*
    The GraphManager class is an internal class that abstracts modifications
    to an underlying graph object, stored in GraphManager#graph. This class
    handles reads and writes to the graph; this base implementation leverages
    the graphlib library (https://github.com/cpettitt/graphlib/wiki).
    */

    // The underlying graphlib.Graph object
    graph: graphlib.Graphd;
    activeNode: ?string;

    constructor() {
        /*
        Instantiate the GraphManager.

        No arguments.
        */
        this.graph = new graphlib.Graph();
        this.activeNode = undefined;
    }

    addNode(node: Node) {
        /*
        Add a new node to the graph.

        Arguments:
            node (Node): The node to add. See ../types/Graph:Node

        Returns:
            None
        */
        this.graph.setNode(node.id, node);
    }

    appendNode(node: Node) {
        /*
        Adds a new node to the graph as a linked descendent of the graph's
        current node. If there is no current node, this is equivalent to
        addNode.
        */
        this.graph.setNode(node.id, node);
        if (!!this.activeNode) {
            this.graph.setEdge(node.id, this.activeNode);
        }
        this.activeNode = node.id;
        console.log(this);
    }

    unsetActiveNode() {
        /*
        Unset the active node in the trace. This effectively "severs" the
        trace -- good for starting a new branch.
        */
        console.log("unsetting")
        this.activeNode = undefined;
    }

    getNodes() {
        /*
        Returns a list of nodes from the graph.
        */
        return this.graph.nodes().map(n => this.graph.node(n))
    }

    getLines() {
        /*
        Returns a list of edges from the graph as [[x, y, z], [x, y, z]] pairs
        */
        return this.graph.edges().map(
            ({ v, w }) => [this.graph.node(v), this.graph.node(w)]
        );
    }

}


export default class Trace {
    /*
    Trace is the p5 "layer" that holds trace inform ation for a session.

    It uses the GraphManager class (above) to handle abstract graph
    manipulations, but all rendering and user-level interaction should be
    handled in this class.
    */

    // The p5 instance to draw to
    p: P5Type;

    // The graph manager, as per above.
    graphManager: GraphManager;

    // Whether to render the layer. Can be changed in realtime
    visible: boolean;

    constructor(opts: Object) {
        /*
        Create a new Trace. This should be done in the `setup` of the p5
        instance, which takes place in App.js.
        */
        this.p = opts.p;

        // Start visible
        this.visible = true;
        // Create the GraphManager instance for later use.
        this.graphManager = new GraphManager();
    }

    draw(): void {
        /*
        Draw the synapses.

        Arguments:
            p: The p5 instance in which to draw

        Returns:
            None
        */
        if (!this.visible) { return; }

        let p = this.p;
        p.noStroke();

        for (let n of this.graphManager.getNodes()) {
            let dist = p.dist(n.screenX, n.screenY, p.mouseX, p.mouseY);
            if (dist < 50) {
                // TODO: Check for closeness of frame
                // TODO: Highlight active node
                p.fill(...LINE_COLOR, 150 - (2 * dist));
                p.ellipse(n.screenX, n.screenY, 10, 10);
            }
            if (n.id == this.graphManager.activeNode) {
                let d = 15 + (5 * (Math.sin(new Date()/250)+1));
                p.fill(250, 150, 0, 200-5*d);
                p.ellipse(n.screenX, n.screenY, d, d);
            }
        }

        p.strokeWeight(3);
        p.stroke(255, 0, 0, 100);
        for (let n of this.graphManager.getLines()) {
            // if (n.z) { // TODO: Check for closeness of frame
                p.line(n[0].screenX, n[0].screenY, n[1].screenX, n[1].screenY)
            // }
        }
    }

    dropNode(): void {
        let p = this.p;

        this.graphManager.appendNode(new Node({
            x: p.mouseX,
            y: p.mouseY,
            z: 100,
            screenX: p.mouseX,
            screenY: p.mouseY,
        }));
    }

    severTrace(): void {
        this.graphManager.unsetActiveNode();
    }

    mousePressed(): void {
        let p = this.p;

        if (p.mouseButton == p.RIGHT) {
            // TODO: Select closest node
        }
    }
}
