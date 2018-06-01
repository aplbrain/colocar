// @flow
type Question = {
    _id: string
};

export default class Colocar {

    // The token used to authenticate with the server
    token: string;

    // The colocard host
    host: string;

    // The colocard user
    user: string;

    constructor(opts: { token: string, host: string, user: string }) {
        // Set the host and token
        this.host = opts.host;
        this.token = opts.token;
        this.user = opts.user;
    }

    url(path: string) {
        /*
        Construct a URL for the colocar API.

        Arguments:
            path (string): The path to append. Leading slashes will be removed.

        Returns:
            string: The complete URL.
        */
        if (path[0] == "/") { path = path.slice(1); }
        return `http://${this.host}/${path}`
    }

    // Questions
    getQuestions(): Promise<Object> {
        return fetch(this.url(`/questions`)).then(data => {
            return data.json();
        });
    }

    getNextUserQuestion(): Promise<Object> {
        return this.getQuestions().then(qs => {
            return qs
                .filter(q => (
                        (q.assignee === this.user) &&
                        (q.status === "pending")
                    )
                )
                .sort(q => -1 * q.priority)[0]
        });
    }

    // Nodes
    getNodes(): Promise<Object> {
        return fetch(this.url(`/nodes`)).then(data => {
            return data.json();
        });
    }

    postNodes(nodes: Object | Object[]): Promise<Object> {
        return fetch(this.url(`/nodes`), {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(nodes)
        }).then(data => {
            return data.json();
        });
    }
}


// [{
//     coordinate: { x: 1, y: 1, z: 1 },
//     created: new Date() * 1,
//     author: "test",
//     volume: "test1",
//     namespace: "test.jordan",
//     type: "synapse"
// }, {
//         coordinate: { x: 1, y: 1, z: 1 },
//         created: new Date() * 1,
//         author: "test",
//         volume: "test1",
//         namespace: "test.jordan",
//         type: "synapse"
//     }]
