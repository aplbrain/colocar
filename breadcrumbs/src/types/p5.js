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
    fill: (r: number, g: ?number, b: ?number, a: ?number) => void,

    line: Function,

    ellipse: (number, number, number, number) => void,

    stroke: Function,
    noStroke: () => void,
    strokeWeight: Function,

    image: Function,

    // Core
    setup: () => void,
    draw: () => void,

    // Events
    windowResized: Function,
    mousePressed: Function,
    keyTyped: Function,
    key: string,
    // Mouse:
    mouseWheel: Function,
    mouseX: number,
    mouseY: number,
    RIGHT: number,

    // Image
    loadImage: Function,

    // Geometry
    dist: (x0: number, y0: number, x1: number, y1: number) => number
};
