// @flow

import Log from "colocorazon/log";
import Config from "./_config";

interface Database {
    getNextQuestion(string, string): Promise<Object>;
    postGraph(string, string, Object, string): any;
}


class Colocard implements Database {

    url: string;
    headers: Object;
    breadcrumbs_name: string;

    constructor(opts?: {url?: string}) {
        /*
        Create a new Colocard client.

        Arguments:
        opts: Object. Should include url (str)

        */
        opts = opts || {};
        this.url = opts.url || Config.colocardUrl;
        this.headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        };
        this.breadcrumbs_name = "breadcrumbs";
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
        ).then(resList => this._onQuestionSuccess(user, resList)
        ).catch(err => this._onException(err));
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
            volume.collection = splitUri[nUri-3];
            volume.experiment = splitUri[nUri-2];
            volume.channel = splitUri[nUri-1];
            let graphId = question.instructions.graph;
            let graphPromise = fetch(`${this.url}/graphs/${graphId}`, {
                headers: this.headers
            }).then((res: Response) => res.json());
            let fullQuestionPromise = graphPromise.then((graph: any) => {
                question.instructions.graph = graph;
                let statusPromise = this._setOpenStatus(question);
                return statusPromise.then(() => {
                    return {question, volume};
                });
            });
            return fullQuestionPromise;
        });
        return questionPromise;
    }

    _setOpenStatus(question: Question) {
        return fetch(`${this.url}/questions/${question._id}/status`, {
            headers: this.headers,
            method: "PATCH",
            body: JSON.stringify({"status": "open"})
        });
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
                namespace: this.breadcrumbs_name,
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

    updateQuestionStatus(questionId: string, status: string): Promise<Response> {
        return fetch(`${this.url}/questions/${questionId}/status`, {
            headers: this.headers,
            method: "PATCH",
            body: JSON.stringify({status})
        });
    }

}

export {
    Colocard
};
