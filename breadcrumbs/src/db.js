// @flow

import type {Question} from "./types/colocardTypes";

interface Database {
    getNextQuestion(string, string): Promise<Object>;
    postGraph(Object): any;
}


class Ramongo implements Database {

    url: string;
    headers: Object;
    breadcrumbs_name: string;

    constructor() {
        this.url = "https://ramongo.thebossdev.io";
        this.headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        };
        this.breadcrumbs_name = "NEURON.PAINT";
    }

    _encode(obj: Object) {
        return Object.keys(obj).map((key) => {
            return encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]);
        }).join('&');
    }

    getNextQuestion(user: string, type: string) {
        return fetch(`${this.url}/questions/next/${type}`, {
            headers: this.headers,
            method: "POST",
            body: this._encode({
                user: user
            })
        }).then((res: Promise) => res.json()).then((json: any) => {
            let question = json.data;

            return fetch(`${this.url}/volume/${question.volume}`, {
                headers: this.headers,
            }).then((res: Promise) => res.json()).then((json: any) => {
                let volume = json;

                return fetch(`${this.url}/synapse/id/${question.synapseId}`, {
                    headers: this.headers,
                }).then((res: Promise) => res.json()).then((json: any) => {
                    question.synapse = json;
                    return {
                        question,
                        volume
                    };
                });
            });
        });
    }

    postGraph(graph) {
        console.log(graph);
        return;
    }

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
       this.url = opts.url || "http://colocard:9005";
       this.headers = {
           'Accept': 'application/json',
           'Content-Type': 'application/json'
       };
       this.breadcrumbs_name = "breadcrumbs";
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
            console.log(question);
            let splitUri = volume.uri.split('/');
            let nUri = splitUri.length;
            volume.collection = splitUri[nUri - 3];
            volume.experiment = splitUri[nUri - 2];
            volume.channel = splitUri[nUri - 1];
            let graphId = question.instructions.graph;
            return fetch(`${this.url}/graphs/${graphId}`, {
                headers: this.headers
            }).then((res: Response) => res.json()).then((json: any) => {
                question.instructions.graph = json;
                return this._setOpenStatus(question);
            }).then(() => {
                return {
                    question,
                    volume
                };
            });
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

    postGraph(graph: Object): Promise<string> {
        /*
        Post a graph to the colocard API.

        Arguments:
            graph (Object): The graph to post. Should be fully
                well-formed graph object

        */
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
    Ramongo,
    Colocard
};
