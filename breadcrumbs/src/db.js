// @flow

interface Database {
    // saveGraph(graph: Object): Promise<boolean>,
    getNextQuestion(string, string): Promise<Object>,
    postGraph(Object, string, string, string): Promise<Object>,
}


class Ramongo implements Database {
    /*
    The base class for Ramongo.

    Ramongo inherits from the Database interface.
    For more information, see:
    aplmicrons/confirms-private:modules/proofreaders/breadcrumbs/config.js
    */

    // The base URL to use
    url: string;
    // Default headers to use
    headers: Object;

    constructor() {
        this.url = "https://ramongo.thebossdev.io";
        this.headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        };
    }

    _encode(obj: Object) {
        /*
        Encode an object into URL-encoded param format.

        For example, {a:1} -> "?a=1"
        */
        return Object.keys(obj).map((key) => {
            return encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]);
        }).join('&');
    }

    getNextQuestion(user: string, type: string) {
        /*
        Get the next question (and its accompanying volume) for a user.
        */
        // Get the next question:
        return fetch(`${this.url}/questions/next/${type}`, {
            headers: this.headers,
            method: "POST",
            body: this._encode({ user: user })
        }).then((res: Promise) => res.json()).then((json: any) => {
            // The question is returned under the `data` key:
            let question = json.data;

            // Using that information, fetch the volume that corresponds
            // with this question:
            return fetch(`${this.url}/volume/${question.volume}`, {
                headers: this.headers,
            }).then((res: Promise) => res.json()).then((json: any) => {
                // Now return both the question and the volume in one go.
                // This prevents ugly nesting in the core application code.
                return {
                    question,
                    volume: json
                };
            });
        });
    }

    postGraph(
        graph: Object,
        author: string,
        volume: string,
        questionId: string
    ) {
        /*
        Post a graph to the database.

        The graph should be in graphlib notation.
        */
        let submitObj = {};
        submitObj.author = author;
        submitObj.volume = volume;
        submitObj.user = author;
        submitObj.questionId = questionId;
        submitObj.tag = `breadcrumbs_v2_annotation_human`;
        submitObj.date = new Date();
        submitObj.graph = JSON.stringify(graph);

        return fetch(this.url + "graphs/", {
            method: "POST",
            headers: this.headers,
            body: this._encode(submitObj)
        }).then(res => res.json()).then(result => {
            return result;
        });
    }

}


export {
    Ramongo,
    // Colocard
};
