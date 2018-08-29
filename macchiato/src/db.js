// @flow

import Log from "./log";
import type {Question} from "./types/colocardTypes";
import Config from "./_config";

interface Database {
    getNextQuestion(string, string): Promise<Object>;
    postGraphProof(string, string, Object, string): any;
}


class Colocard implements Database {

    url: string;
    headers: Object;
    macchiatoAppName: string;

    constructor(opts?: {url?: string}) {
        /*
        Create a new Colocard client.

        Arguments:
        opts: Object. Should include url (str)

        */
        opts = opts || {};
        this.url = opts.url || Config.colocardUrl;
        this.headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
        this.macchiatoAppName = "macchiato";
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
        ).then(resList => this._onQuestionSuccess(resList)
        ).catch(err => this._onException(err));
    }

    _onQuestionSuccess(resList: Array<Response>): Promise<Question> {
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
            let volume = question.volume;
            let splitUri = volume.uri.split('/');
            let nUri = splitUri.length;
            volume.collection = splitUri[nUri-3];
            volume.experiment = splitUri[nUri-2];
            volume.channel = splitUri[nUri-1];
            console.log({question});
            let nodeId = question.instructions.node;
            let nodePromise = fetch(`${this.url}/nodes/${nodeId}`, {
                headers: this.headers
            }).then((res: Response) => res.json());
            let fullQuestionPromise = nodePromise.then((node: any) => {
                question.instructions.node = node;
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

    _onException(reason: any) {
        Log.error(reason);
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
            body: JSON.stringify({status})
        });
    }

}

export {
    Colocard
};