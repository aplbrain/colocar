
module DB = {

    let allQuestions = (): list(Ramongo.question) => {
        let a: Ramongo.question = {
            id: "X",
            created: None,
            opened: None,
            closed: None,
            priority: Ramongo.High,
            status: Ramongo.Pending,
            application: Ramongo.Breadcrumbs,
            assignee: "X",
            author: "X",
            volume: "X",
        };
        [a, a];
    };

    let allNodes = (): list(Ramongo.node) => {
        let a: Ramongo.node = {
            id: "X",
            created: None,
            submitted: None,
            author: "X",
            volume: "X",
            coordinate: {x: 1, y: 2, z: 3},
            nodeType: Ramongo.Synapse,
            graph: "X"
        };
        [a, a];
    };

    let allEdges = (): list(Ramongo.edge) => {
        let a: Ramongo.edge = {
            id: "X",
            created: None,
            submitted: None,
            author: "X",
            volume: "X",
            from: "X",
            to_: "X",
            graph: "X"
        };
        [a, a];
    }
};


let getUserQuestions = (username: string): list(Ramongo.question) => {
    List.filter((a: Ramongo.question) => {
        a.assignee == username
    }, DB.allQuestions());
};


let getUserVolumeGraph = (userID: Ramongo.userID, volumeID: Ramongo.volumeID): Ramongo.graph => {
    let nodes = List.filter((node: Ramongo.node) => {
        node.volume === volumeID && node.author == userID
    }, DB.allNodes());
    let edges = List.filter((edge: Ramongo.edge) => {
        edge.volume === volumeID && edge.author == userID
    }, DB.allEdges());
    {
        nodes: nodes,
        edges: edges,
        author: userID,
        volume: volumeID,
        /* question: ??,
        submitted: ?? */
    };
};
