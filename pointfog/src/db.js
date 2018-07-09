// @flow

import type {Node, Question} from "./types/colocardTypes";
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
        return fetch(`${this.url}/questions?q={"assignee": "${user}", "namespace": "${type}", "active": true }`, {
            headers: this.headers,
            method: "GET"
        }).then(res => this._onQuestionSuccess(res)).catch(err => this._onException(err));
    }

    _onQuestionSuccess(res: Response): Promise<Question> {
        return res.json().then((json: any) => {
            let questions: Array<Question> = json;
            let question: Question = this._extractPrioritizedQuestion(questions);
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
    }

    _extractPrioritizedQuestion(questions: Array<Question>): Question {
        let question: Question = null;
        let openQuestions = questions.filter(question => question.status === "open");
        let nOpen = openQuestions.length;
        if (nOpen > 1) {
            throw "cannot have more than one open question - ask an admin";
        } else if (nOpen === 1) {
            question = openQuestions[0];
        } else {
            let pendingQuestions = questions.filter(question => question.status === "pending");
            let nPending = pendingQuestions.length;
            if (nPending === 0) {
                throw "you don't have any open or pending questions - ask an admin";
            } else {
                let prioritizedQuestions = pendingQuestions.sort(function(a, b) {
                    return a.priority - b.priority;
                });
                question = prioritizedQuestions[nPending-1];
            }
        }
        return question;
    }

    _setOpenStatus(question: Question) {
        return fetch(`${this.url}/questions/${question._id}/status`, {
            headers: this.headers,
            method: "PATCH",
            body: JSON.stringify({"status": "open"})
        });
    }

    _onException(reason: any) {
        console.log(reason);
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
        ).then(values => {
            console.log(values);
            return "completed";
        }).catch(reason => {
            console.log(reason);
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
