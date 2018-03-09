type nodeID = string;
type edgeID = string;
type volumeID = string;
type userID = string;
type questionID = string;
type graphID = string;

type priority =
  | Low
  | Medium
  | High;

type status =
  | Pending
  | Opened
  | Completed
  | Error;

type application =
  | Breadcrumbs
  | SynapsePaint
  | SynapseYNM;

type classification =
  | Beginner
  | Intermediate
  | Expert;

type user = {
    id: userID,
    username: string,
    classification: classification,
    created: int
};

type date = option(int);

type vector3 = {
    x: int,
    y: int,
    z: int
};

type cuboid = {
    x: (int, int),
    y: (int, int),
    z: (int, int)
};

type bossURI = {
    collection: string,
    experiment: string,
    channel: string
};

type nodeType =
  | None
  | Dendrite
  | Axon
  | Region
  | Synapse
  | PreSynapse
  | PostSynapse
  | CellBody
  | BloodVessel;


type volume = {
    id: volumeID,
    author: user,
    created: date,
    center: vector3,
    voxelsize: vector3,
    bossURI: bossURI,
    name: string,
    private: bool,
    resolution: int,
    namespace: string, /* "group.subgroup" */
    small: cuboid,
    large: cuboid
};

type question = {
    id: string,
    author: userID,
    created: date,
    opened: date,
    closed: date,
    priority: priority,
    status: status,
    application: application,
    assignee: userID,
    volume: volumeID,
};

type node = {
    id: nodeID,
    graph: graphID,
    created: date,
    submitted: date,
    author: userID,
    volume: volumeID,
    coordinate: vector3,
    nodeType: nodeType
};

type edge = {
    id: string,
    graph: graphID,
    created: date,
    submitted: date,
    author: userID,
    volume: volumeID,
    from: nodeID,           /* from/to? */
    to_: nodeID
};

type graph = {
    nodes: list(node),
    edges: list(edge),
    author: userID,
    question: questionID,
    volume: volumeID,
    submitted: date,
};
