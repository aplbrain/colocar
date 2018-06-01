// @flow

interface Database {
    saveGraph(graph: Object): Promise<boolean>,
    getQuestion(): Promise<Object>
}


class Ramongo {

    url: string;
    headers: Object;

    constructor() {
        this.url = "https://ramongo.thebossdev.io/";
        this.headers = {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        };
    }

    _encode(obj: Object) {
        return Object.keys(obj).map((key) => {
            return encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]);
        }).join('&');
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
