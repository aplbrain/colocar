// @flow

import type {Question} from "./types/colocardTypes";
import Config from "./_config";

interface Database {
    getNextQuestion(string, string): Promise<Object>;
}


class Colocard implements Database {

    url: string;
    headers: Object;
    matchmaker_name: string;

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
        this.matchmaker_name = "breadcrumbs";
    }

    getGraphsAndVolume(graphIdA: string, graphIdB: string) {
        return fetch(`${this.url}/graphs?q={"namespace": "${this.matchmaker_name}", "active": true}`, {
            headers: this.headers,
            method: "GET"
        }).then(res => this._onQuestionSuccess(res, graphIdA, graphIdB)).catch(err => this._onException(err));
    }

    _onQuestionSuccess(res: Response, graphIdA: string, graphIdB: string): Promise<Question> {
        return res.json().then((json: any) => {
            console.log(json);
            let graphMetaA: Object = json.filter(g => g._id === graphIdA)[0];
            let graphMetaB: Object = json.filter(g => g._id === graphIdB)[0];
            let volume: Object;
            console.log(graphMetaA);
            console.log(graphMetaB);
            console.assert(graphMetaA.volume === graphMetaB.volume);
            let volumeId: string = graphMetaA.volume;
            let graphA = graphMetaA.structure;
            let graphB = graphMetaB.structure;

            return fetch(`${this.url}/volumes/${volumeId}`, {
                headers: this.headers
            }).then((res: Response) => res.json()).then((json: any) => {
                volume = json;
                let splitUri = volume.uri.split('/');
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
        });
    }

    _onException(reason: any) {
        console.log(reason);
    }

}

export {
    Colocard
};
