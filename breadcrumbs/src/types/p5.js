type P5Type = {

    width: number,
    height: number,

    createCanvas: Function,
    resizeCanvas: Function,
    createGraphics: Function,

    // Drawing
    background: Function,
    line: Function,

    stroke: Function,
    strokeWeight: Function,

    image: Function,

    // Core
    setup: Function,
    draw: Function,

    // Events
    windowResized: Function,

    // Image
    loadImage: Function
};
