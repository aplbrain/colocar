// @flow
import type { Question } from "./types/colocard";
import Log from "./log";
import Config from "./_config";


interface Database {
    getNextQuestion(string, string): Promise<Object>;
    postGraph(string, string, Object, string): any;
}

class Colocard implements Database {

    url: string;
    headers: Object;
    namespace: string;

    constructor(opts?: { url?: string, namespace?: string }) {
        /*
        Create a new Colocard client.

        Arguments:
        opts: Object. Should include url (str)

        */
        opts = opts || {};
        this.url = opts.url || Config.colocardUrl;
        this.namespace = opts.namespace || "colocar";
    }

    get headers() {
        return {
            "Accept": "application/json",
            "Authorization": `Bearer ${window.keycloak.token}`,
            "Content-Type": "application/json",
        };
    }

    getTwoGraphsAndVolume(graphIdA: string, graphIdB: string) {
        let graphMetaA: Object;
        let graphMetaB: Object;
        return fetch(`${this.url}/graphs/${graphIdA}`, {
            headers: this.headers,
            method: "GET"
        }).then(res => res.json()).then(json => {
            graphMetaA = json;
            return fetch(`${this.url}/graphs/${graphIdB}`, {
                headers: this.headers,
                method: "GET"
            });
        }).then(res => res.json()).then(json => {
            graphMetaB = json;
            return this._onGraphSuccess(graphMetaA, graphMetaB);
        }).catch(err => this._onException(err));
    }

    _onGraphSuccess(graphMetaA: Object, graphMetaB: Object): Promise<Question> {
        let volume: Object;
        console.assert(graphMetaA.volume === graphMetaB.volume);
        let volumeId: string = graphMetaA.volume;
        let graphA = graphMetaA.structure;
        let graphB = graphMetaB.structure;
        graphA.author = graphMetaA.author;
        graphB.author = graphMetaB.author;

        return fetch(`${this.url}/volumes/${volumeId}`, {
            headers: this.headers
        }).then((res: Response) => res.json()).then((json: any) => {
            volume = json;
            let splitUri = volume.uri.split("/");
            let nUri = splitUri.length;
            volume.collection = splitUri[nUri - 3];
            volume.experiment = splitUri[nUri - 2];
            volume.channel = splitUri[nUri - 1];
            return {
                graphA,
                graphB,
                volume
            };
        });
    }

    _onException(reason: Error) {
        Log.error(reason);
        throw reason;
    }

    getNextQuestion(user: string, type: string) {
        let openPromise = fetch(`${this.url}/questions?q={"active": true, "assignee": "${user}", "namespace": "${type}", "status": "open"}`, {
            headers: this.headers,
            method: "GET"
        });
        let pendingPromise = fetch(`${this.url}/questions?q={"active": true, "assignee": "${user}", "namespace": "${type}", "status": "pending"}&sort=-priority`, {
            headers: this.headers,
            method: "GET"
        });
        return Promise.all(
            [openPromise, pendingPromise]
        ).then(resList => ({
            "breadcrumbs": this._onQuestionSuccess.bind(this),
            "matchmaker": this._onQuestionSuccess.bind(this),
            "macchiato": this._onQuestionSuccessMacchiato.bind(this),
        }[type])(user, resList)
        ).catch(err => this._onException(err));
    }

    _onQuestionSuccessMacchiato(user: string, resList: Array<Response>): Promise<Question> {
        /*
        TODO: Merge this with regular _onQuestionSuccess
        */
        let jsonList = resList.map(res => res.json());
        let questionPromise = Promise.all(jsonList).then(questionsList => {
            let openQuestions: Array<Question> = questionsList[0];
            let pendingQuestions: Array<Question> = questionsList[1];
            let question;
            if (openQuestions.length > 0) {
                question = openQuestions[0];
            } else {
                if (pendingQuestions.length > 0) {
                    question = pendingQuestions[0];
                } else {
                    throw new Error("you don't have any open or pending questions - ask an admin");
                }
            }
            if (question.assignee !== user) {
                throw new Error("this question is assigned to a different user - ask an admin");
            }
            let volume = question.volume;
            let splitUri = volume.uri.split("/");
            let nUri = splitUri.length;
            volume.collection = splitUri[nUri - 3];
            volume.experiment = splitUri[nUri - 2];
            volume.channel = splitUri[nUri - 1];
            let nodeId = question.instructions.node;
            let nodePromise = fetch(`${this.url}/nodes/${nodeId}`, {
                headers: this.headers
            }).then((res: Response) => res.json());
            let fullQuestionPromise = nodePromise.then((node: any) => {
                question.instructions.node = node;
                return this._setOpenStatus(question).then(() => {
                    return { question, volume };
                });
            });
            return fullQuestionPromise;
        });
        return questionPromise;
    }

    _onQuestionSuccess(user: string, resList: Array<Response>): Promise<Question> {
        let jsonList = resList.map(res => res.json());
        let questionPromise = Promise.all(jsonList).then(questionsList => {
            let openQuestions: Array<Question> = questionsList[0];
            let pendingQuestions: Array<Question> = questionsList[1];
            let question;
            if (openQuestions.length > 0) {
                question = openQuestions[0];
            } else {
                if (pendingQuestions.length > 0) {
                    question = pendingQuestions[0];
                } else {
                    throw new Error("you don't have any open or pending questions - ask an admin");
                }
            }
            if (question.assignee !== user) {
                throw new Error("this question is assigned to a different user - ask an admin");
            }
            let volume = question.volume;
            let splitUri = volume.uri.split("/");
            let nUri = splitUri.length;
            volume.collection = splitUri[nUri - 3];
            volume.experiment = splitUri[nUri - 2];
            volume.channel = splitUri[nUri - 1];
            let graphId = question.instructions.graph;
            let graphPromise = fetch(`${this.url}/graphs/${graphId}`, {
                headers: this.headers
            }).then((res: Response) => res.json());
            let fullQuestionPromise = graphPromise.then((graph: any) => {
                question.instructions.graph = graph;
                return this._setOpenStatus(question).then(() => {
                    return { question, volume };
                });
            });
            return fullQuestionPromise;
        });
        return questionPromise;
    }

    _setOpenStatus(question: Question) {
        let statusPromise = Promise.resolve();
        if (question.status !== "open") {
            statusPromise = fetch(`${this.url}/questions/${question._id}/status`, {
                headers: this.headers,
                method: "PATCH",
                body: JSON.stringify({ "status": "open" })
            });
        }
        return statusPromise;
    }

    _onException(reason: Error) {
        Log.error(reason);
        throw reason;
    }

    postGraph(author: string, parent: string, structure: Object, volume: string): Promise<string> {
        /*
        Post a graph to the colocard API.

        Arguments:
        graph (Object): The graph to post. Should be fully
        well-formed graph object

        */
        structure.multigraph = structure.options.multigraph;
        structure.directed = structure.options.directed;
        structure.links = structure.edges;
        delete structure.edges;
        delete structure.options;


        return fetch(`${this.url}/graphs`, {
            headers: this.headers,
            method: "POST",
            body: JSON.stringify({
                author: author,
                namespace: this.namespace,
                parent: parent,
                structure: structure,
                volume: volume
            })
        }).then(() => {
            return "completed";
        }).catch(reason => {
            Log.error(reason);
            return "errored";
        });
    }

    postArtifacts(questionId: string, artifacts: Object): Promise<Response> {
        // convert artifacts to flattened array
        let artifactsArray = [];
        for (let artifact in artifacts) {
            for (let zIndex in artifacts[artifact]) {
                artifactsArray.push({
                    "type": artifact,
                    "zslice": zIndex
                });
            }
        }
        return fetch(`${this.url}/questions/${questionId}/artifacts`, {
            headers: this.headers,
            method: "PATCH",
            body: JSON.stringify(artifactsArray)
        });
    }

    postNodeDecision(decision: string, author: string, nodeId: string): Promise<string> {
        /*
        Post a node decision to the colocard API.

        Arguments:
        node (Object): The node to post. Should be fully
        well-formed node object

        */

        return fetch(`${this.url}/nodes/${nodeId}/decisions`, {
            headers: this.headers,
            method: "PATCH",
            body: JSON.stringify({
                author: author,
                decision: decision
            })
        }).then(() => {
            return "completed";
        }).catch(reason => {
            Log.error(reason);
            return "errored";
        });
    }

    updateQuestionStatus(questionId: string, status: string): Promise<Response> {
        return fetch(`${this.url}/questions/${questionId}/status`, {
            headers: this.headers,
            method: "PATCH",
            body: JSON.stringify({ status })
        });
    }

}

export {
    Colocard
};
