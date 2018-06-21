// @flow

interface Database {
    // saveGraph(graph: Object): Promise<boolean>,
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


class Colocard {
    saveGraph(graph: Object) {

    }
}

export {
    Ramongo,
    Colocard
};
