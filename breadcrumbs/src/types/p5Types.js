// @flow

export type P5Image = {
    height: number,
    width: number,
};

export type P5Type = {

    width: number,
    height: number,

    windowWidth: number,
    windowHeight: number,

    createCanvas: (width: number, height: number) => Object,
    resizeCanvas: (width: number, height: number) => Object,
    createGraphics: Function,
    frameRate: (number) => void,
    canvas: Object,

    // Drawing
    background: (r: number, g: ?number, b: ?number, a: ?number) => void,
    fill: (r: number, g: ?number, b: ?number, a: ?number) => void,

    line: (x0: number, y0: number, x1: number, y1: number) => void,

    ellipse: (number, number, number, number) => void,
    rect: (number, number, number, number) => void,
    rectMode: Function,

    stroke: (r: number, g: ?number, b: ?number, a: ?number) => void,
    noStroke: () => void,
    strokeWeight: (number) => void,


    // Core
    setup: () => void,
    draw: () => void,
    clear: () => void,

    // Events
    windowResized: Function,

    mousePressed: Function,
    mouseClicked: Function,
    mouseDragged: Function,

    keyTyped: Function,
    keyPressed: Function,
    key: string,
    keyCode: number,
    // Mouse:
    mouseWheel: Function,
    mouseX: number,
    mouseY: number,
    pmouseX: number,
    pmouseY: number,

    RIGHT: number,
    CENTER: number,

    // Image
    loadImage: (string, Function, Function, Object) => P5Image,
    Image: P5Image,
    image: (Object, number, number, number, number) => void,
    imageMode: Function,

    // Geometry
    dist: (x0: number, y0: number, x1: number, y1: number) => number,

    text: Function,
    textSize: Function,
    textAlign: Function,
};
