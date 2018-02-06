// @flow

import React, { Component } from 'react';
import './App.css';

import p5 from 'p5';

type AppProps = {};

class App extends Component<AppProps> {

    render() {
        return (
            <div>
                <P5Breadcrumbs />
            </div>
        );
    }

}


type P5Type = {

    width: number,
    height: number,

    createCanvas: Function,
    resizeCanvas: Function,
    createGraphics: Function,

    // Drawing
    background: Function,
    line: Function,

    // Core
    setup: Function,
    draw: Function,

    // Events
    windowResized: Function,
};

type P5BreadcrumbsProps = {};


class P5Breadcrumbs extends Component<P5BreadcrumbsProps> {

    _id: string;
    sketch: any;
    config: Object;
    ghostLayer: number;
    layers: Object;
    p: P5Type;

    constructor(props) {
        super(props);
        let self = this;
        self._id = `p5-container-${Math.round(100 * Math.random())}`;

        self.sketch = (p: P5Type) => {

            class Crosshairs {

                p: P5Type;

                constructor(opts: Object) {
                    this.p = opts.p;
                    console.log(this.p)
                }

                draw(p: P5Type) {
                    p.line(p.width / 2, 0, p.width / 2, p.height / 2);
                    p.line(0, p.height / 2, p.width / 2, p.height / 2);
                }
            }

            p.setup = function() {
                let canvas = p.createCanvas(500, 500);
                canvas.parent(self._id);
                self.ghostLayer = p.createGraphics(p.width, p.height);
                console.log(p);
                self.layers = {
                    crosshairs: new Crosshairs(p),
                };

                self.config = {
                    renderCrosshairs: true,
                }
            };

            p.draw = function() {
                p.background(200);

                if (self.config.renderCrosshairs) {
                    self.layers.crosshairs.draw(p);
                }
            };

            p.windowResized = function() {
                p.resizeCanvas(500, 500);
            }
        };
    }

    componentDidMount() {
        var myp5 = new p5(this.sketch);
    }

    render() {
        return (
            <div id={ this._id }></div>
        )
    }
}

export default App;
