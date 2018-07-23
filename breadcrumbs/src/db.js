// @flow

import type {Question} from "./types/colocardTypes";
import Config from "./_config";


class Colocard {

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
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
        this.breadcrumbs_name = "breadcrumbs";
    }

    getNextQuestion(user: string, type: string) {
        let self = this;
        return fetch(`${this.url}/questions?q={"assignee": "${user}", "namespace": "${type}", "active": true }`, {
            headers: this.headers,
            method: "GET"
        }).then(res => self._onQuestionSuccess(res)).catch(err => self._onException(err));
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
            question = openQuestions[0];
        } else if (nOpen === 1) {
            question = openQuestions[0];
        } else {
            let pendingQuestions = questions.filter(question => question.status === "pending");
            let nPending = pendingQuestions.length;
            if (nPending === 0) {
                throw new Error("You don't have any open or pending questions. Ask an admin.");
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

    postGraph(structure: Object, volume: string, author: string): Promise<string> {
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
                structure: structure,
                volume: volume
            })
        }).then(values => {
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
