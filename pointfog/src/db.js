// @flow

interface Database {
    postNodes(Array<Object>): any;
    getNextQuestion(string, string): Promise<Object>
}


class Ramongo implements Database {

    url: string;
    headers: Object;

    constructor() {
        this.url = "https://ramongo.thebossdev.io";
        this.headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        };
    }

    _encode(obj: Object) {
        return Object.keys(obj).map((key) => {
            return encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]);
        }).join('&');
    }

    postNodes(nodes) {
        return;
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
                        volume: volume
                    };
                });
            });
        });
    }

}


class Colocard implements Database {

    url: string;
    headers: Object;

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
    }

    postNodes(nodes: Array<Object>): any {
        /*
        Post a list of nodes to the colocard API.

        Arguments:
            nodes (Array<NodeMeta>): The nodes to post. Should each be fully
                well-formed node object

        */
        fetch(`${this.url}/nodes`, {
            headers: this.headers,
            method: "POST",
            body: JSON.stringify(nodes)
        }).then((res: Response) => res.json()).then((json: any, err: any) => {
            console.log(json, err);
        });
    }

    getNextQuestion(user: string, type: string) {
        return fetch(`${this.url}/questions?q={"assignee": "${user}", "namespace": "${type}}"`, {
            headers: this.headers,
            method: "GET"
        }).then((res: Promise) => res.json()).then((json: any) => {
            let questions = json.data;
            let openQuestions = questions.filter(question => question.status === "open");
            let nOpen = openQuestions.length;
            if (nOpen > 1) {
                throw "cannot have more than one open question - ask an admin";
            } else if (nOpen === 1) {
                let question = openQuestions[0];
            } else {
                let pendingQuestions = questions.filter(question => question.status === "pending");
                let nPending = pendingQuestions.length;
                if (nPending === 0) {
                    throw "you don't have any open or pending questions - ask an admin";
                } else {
                    let prioritizedQuestions = questions.sort(function(a, b) {
                        return a.priority - b.priority;
                    });
                    let question = prioritizedQuestions[nPending-1];
                }
            }

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
                        volume: volume
                    };
                });
            });
        });
    }
}

window.cd = new Colocard();

export {
    Ramongo,
    Colocard
};
