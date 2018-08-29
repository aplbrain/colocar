// @flow

import Log from "colocorazon/log";
import type {Node, Question} from "colocorazon/types/colocard";
import Config from "./_config";

interface Database {
    getNextQuestion(string, string): Promise<Question>;
    postNodes(Array<Node>): any;
}


class Colocard implements Database {

    url: string;
    headers: Object;
    pointfog_name: string;

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
        this.pointfog_name = 'pointfog';
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
            this._setOpenStatus(question);
            return {
                question,
                volume
            };
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

    postNodes(nodes: Array<Node>): Promise<string> {
        /*
        Post a list of nodes to the colocard API.

        Arguments:
            nodes (Array<Node>): The nodes to post. Should each be fully
                well-formed node object

        */
        let nodePromises = nodes.map(node => {
            return fetch(`${this.url}/nodes`, {
                headers: this.headers,
                method: "POST",
                body: JSON.stringify(node)
            });
        });
        return Promise.all(
            nodePromises
        ).then(() => {
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
