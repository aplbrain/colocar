// @flow

export type P5Type = {

    width: number,
    height: number,

    windowWidth: number,
    windowHeight: number,

    createCanvas: (width: number, height: number) => Object,
    resizeCanvas: (width: number, height: number) => Object,
    createGraphics: Function,

    // Drawing
    background: (r: number, g: ?number, b: ?number, a: ?number) => void,
    line: Function,

    stroke: Function,
    strokeWeight: Function,

    image: Function,

    // Core
    setup: () => void,
    draw: () => void,

    // Events
    windowResized: Function,
    mousePressed: Function,
    keyTyped: Function,
    mouseWheel: Function,
    key: string,

    // Image
    loadImage: Function
};
