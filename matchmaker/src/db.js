// @flow
import type { Question } from "colocorazon/dist/types/colocard";
import Log from "colocorazon/dist/log";
import Config from "./_config";


class Colocard {

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
        this.matchmaker_name = "breadcrumbs";
    }

    get headers() {
        return {
            "Accept": "application/json",
            "Authorization": `Bearer ${window.keycloak.token}`,
            "Content-Type": "application/json",
        };
    }

    getGraphsAndVolume(graphIdA: string, graphIdB: string) {
        let graphMetaA: Object;
        let graphMetaB: Object;
        return fetch(`${this.url}/graphs/${graphIdA}`, {
            headers: this.headers,
            method: "GET"
        }).then(res => res.json()).then(json => {
            graphMetaA = json;
            return fetch(`${this.url}/graphs/${graphIdB}`, {
                headers: this.headers,
                method: "GET"
            });
        }).then(res => res.json()).then(json => {
            graphMetaB = json;
            return this._onGraphSuccess(graphMetaA, graphMetaB);
        }).catch(err => this._onException(err));
    }

    _onGraphSuccess(graphMetaA: Object, graphMetaB: Object): Promise<Question> {
        let volume: Object;
        console.assert(graphMetaA.volume === graphMetaB.volume);
        let volumeId: string = graphMetaA.volume;
        let graphA = graphMetaA.structure;
        let graphB = graphMetaB.structure;
        graphA.author = graphMetaA.author;
        graphB.author = graphMetaB.author;

        return fetch(`${this.url}/volumes/${volumeId}`, {
            headers: this.headers
        }).then((res: Response) => res.json()).then((json: any) => {
            volume = json;
            let splitUri = volume.uri.split("/");
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
    }

    _onException(reason: Error) {
        Log.error(reason);
        throw reason;
    }

}

export {
    Colocard
};
