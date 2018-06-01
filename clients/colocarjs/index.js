/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 18);
/******/ })
/************************************************************************/
/******/ ({

/***/ 18:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _colocar = __webpack_require__(19);

var _colocar2 = _interopRequireDefault(_colocar);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

window.c = new _colocar2.default({
    host: "10.105.0.36:9005",
    // protocol: "http",
    token: "AAA",
    user: "jordan"
});

/***/ }),

/***/ 19:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Colocar = function () {

    // The colocard host
    function Colocar(opts) {
        _classCallCheck(this, Colocar);

        // Set the host and token
        this.host = opts.host;
        this.token = opts.token;
        this.user = opts.user;
    }

    // The colocard user


    // The token used to authenticate with the server


    _createClass(Colocar, [{
        key: "url",
        value: function url(path) {
            /*
            Construct a URL for the colocar API.
             Arguments:
                path (string): The path to append. Leading slashes will be removed.
             Returns:
                string: The complete URL.
            */
            if (path[0] == "/") {
                path = path.slice(1);
            }
            return "http://" + this.host + "/" + path;
        }

        // Questions

    }, {
        key: "getQuestions",
        value: function getQuestions() {
            return fetch(this.url("/questions")).then(function (data) {
                return data.json();
            });
        }
    }, {
        key: "getNextUserQuestion",
        value: function getNextUserQuestion() {
            var _this = this;

            return this.getQuestions().then(function (qs) {
                return qs.filter(function (q) {
                    return q.assignee === _this.user && q.status === "pending";
                }).sort(function (q) {
                    return -1 * q.priority;
                })[0];
            });
        }

        // Nodes

    }, {
        key: "getNodes",
        value: function getNodes() {
            return fetch(this.url("/nodes")).then(function (data) {
                return data.json();
            });
        }
    }, {
        key: "postNodes",
        value: function postNodes(nodes) {
            return fetch(this.url("/nodes"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(nodes)
            }).then(function (data) {
                return data.json();
            });
        }
    }]);

    return Colocar;
}();

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


exports.default = Colocar;

/***/ })

/******/ });