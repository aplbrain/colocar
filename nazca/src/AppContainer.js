// @flow

import React, { Component } from 'react';

import type { P5Type } from "./types/p5Types";

import NazcaApp from "./NazcaApp";

import './AppContainer.css';

// Though it would be better to use the p5 yarn-installable module, we need
// to load images with authentication headers. So unfortunately, we need to
// use a version of p5 that we can mutate.

// import p5 from 'p5';         // Uncomment if using module
let p5: P5Type = window.p5;     // Uncomment if using <script> tag in html

// Modify the native `loadImage` function in p5.
// https://github.com/processing/p5.js/issues/2634
p5.prototype.loadImage = function (path: string, successCallback: Function, failureCallback: Function, headers: Object) {
    p5._validateParameters('loadImage', arguments);
    var img = new Image();
    var pImg = new p5.Image(1, 1, this);

    let self = this;

    let URL = window.URL || window.webkitURL;
    headers = headers || {};

    fetch(path, {
        headers,
    }).then(res => {
        if (res.ok) {
            res.blob().then(b => {
                // Start loading the image:
                img.src = URL.createObjectURL(b);
            });
        } else {
            console.error(res);
        }
    });

    img.onload = function () {
        pImg.width = pImg.canvas.width = img.width;
        pImg.height = pImg.canvas.height = img.height;

        // Draw the image into the backing canvas of the p5.Image
        pImg.drawingContext.drawImage(img, 0, 0);
        pImg.modified = true;

        if (typeof successCallback === 'function') {
            successCallback(pImg);
        }

        self._decrementPreload();
    };

    img.onerror = function (e) {
        p5._friendlyFileLoadError(0, img.src);
        if (typeof failureCallback === 'function') {
            failureCallback(e);
        }
    };

    //set crossOrigin in case image is served which CORS headers
    //this will let us draw to canvas without tainting it.
    //see https://developer.mozilla.org/en-US/docs/HTML/CORS_Enabled_Image
    // When using data-uris the file will be loaded locally
    // so we don't need to worry about crossOrigin with base64 file types
    if (path.indexOf('data:image/') !== 0) {
        img.crossOrigin = 'Anonymous';
    }

    return pImg;
};

p5.prototype.gradientLine = function(x1: number, y1: number, x2: number, y2: number, a: string, b: string, stroke: number) {
    let dx = x2 - x1;
    let dy = y2 - y1;
    let tStep = 1.0/this.dist(x1, y1, x2, y2);
    for (let t = 0; t < 1; t += tStep) {
        this.fill(this.lerpColor(a, b, t));
        this.ellipse(x1 + t * dx,  y1 + t * dy, stroke, stroke);
    }
};

type AppContainerProps = {};

class AppContainer extends Component<AppContainerProps> {
    render() {
        return (
            <NazcaApp />
        );
    }
}

export default AppContainer;
