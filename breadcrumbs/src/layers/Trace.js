// @flow

import P5Type from "../types/p5";


type Graph = {
    nodes: Node[];
    edges: Edge[];
};

type Node = {

    x: number;
    y: number;
    z: number;

    created: ?Date;
    author: ?string;
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
    The GraphManager class is an internal class that abstracts the modifications
    to an underlying graph object, stored in GraphManager#graph. This class
    handles reads and writes to the graph; this base implementation leverages
    the jsnetworkx library (http://jsnetworkx.org/).
    */

    // The underlying jsnetworkx.Graph object
    graph: Graph;

    constructor() {
        /*
        Instantiate the GraphManager.

        No arguments.
        */
        // Create a new graph object
        let graph: Graph = {
            nodes: [],
            edges: []
        };

        this.graph = graph;
    }

    addNode(node: Node) {
        /*
        Add a new node to the graph.

        Arguments:
            node (Node): The node to add. See ../types/Graph:Node

        Returns:
            None
        */
        node.created = node.created || new Date();
        this.graph.nodes.push(node);
    }

}


export default class Trace {
    /*
    Trace is the p5 "layer" that holds trace information for a session.

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
        p.fill(0, 230, 250, 100);
        p.noStroke();

        // for (let syn of this.synapses) {
        //     if (syn.z) { // TODO: Check for closeness of frame
        //         p.ellipse(syn.screenX, syn.screenY, 50, 50);
        //     }
        // }
    }

    mouseClicked(): void {
        let p = this.p;

        // this.graphManager.addNode({
        //     x: p.mouseX,
        //     y: p.mouseY,
        //     z: 100,
        //     screenX: p.mouseX,
        //     screenY: p.mouseY,
        // });
    }
}
