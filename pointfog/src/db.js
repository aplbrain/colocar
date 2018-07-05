// @flow

import type {Node, Question} from "./types/colocardTypes";

interface Database {
    getNextQuestion(string, string): Promise<Question>;
    postNodes(Array<Node>): any;
}


class Ramongo implements Database {

    url: string;
    headers: Object;
    pointfog_name: string;

    constructor() {
        this.url = "https://ramongo.thebossdev.io";
        this.headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        };
        this.pointfog_name = 'SYNAPSE.PAINT';
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
        }).then((res: Response) => res.json()).then((json: any) => {
            let question = json.data;

            return fetch(`${this.url}/volume/${question.volume}`, {
                headers: this.headers,
            }).then((res: Response) => res.json()).then((json: any) => {
                let volume = json;

                return fetch(`${this.url}/synapse/id/${question.synapseId}`, {
                    headers: this.headers,
                }).then((res: Response) => res.json()).then((json: any) => {
                    question.synapse = json;
                    return {
                        question,
                        volume
                    };
                });
            });
        });
    }

    postNodes(nodes: Array<Node>) {
        console.log(nodes)
        return;
    }

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
        this.url = opts.url || "http://colocard:9005";
        this.headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
        this.pointfog_name = 'pointfog';
    }

    getNextQuestion(user: string, type: string) {
        return fetch(`${this.url}/questions?q={"assignee": "${user}", "namespace": "${type}"}`, {
            headers: this.headers,
            method: "GET"
        }).then(res => this._onQuestionSuccess(res)).catch(err => this._onException(err));
    }

    _onQuestionSuccess(res: Response): Promise<Question> {
        return res.json().then((json: any) => {
            let questions: Array<Question> = json;
            let question: Question = this._extractPrioritizedQuestion(questions);

            return fetch(`${this.url}/volumes/${question.volume}`, {
                headers: this.headers,
            }).then((res: Response) => res.json()).then((json: any) => {
                let volume = json;
                let splitUri = volume.uri.split('/');
                let nUri = splitUri.length;
                volume.collection = splitUri[nUri-3];
                volume.experiment = splitUri[nUri-2];
                volume.channel = splitUri[nUri-1];
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
                let prioritizedQuestions = questions.sort(function(a, b) {
                    return a.priority - b.priority;
                });
                question = prioritizedQuestions[nPending-1];
            }
        }
        return question;
    }

    _onException(reason: any) {
        console.log(reason);
    }

    postNodes(nodes: Array<Node>): Promise {
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
        return Promise.all(nodePromises).then(values => {
            console.log(values);
        }).catch(reason => console.log(reason));
    }

}

export {
    Ramongo,
    Colocard
};
