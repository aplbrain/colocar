// @flow

function error(toLog) {
    console.error(toLog);
}

function log(toLog) {
    console.log(toLog);
}

function info(toLog) {
    console.info(toLog);
}

function warn(toLog) {
    console.warn(toLog);
}

let Log = {
    error,
    info,
    log,
    warn
};

export default Log;
