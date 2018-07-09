<p align=center><img align=center src='./logo.png' width=100 /></p>
<h3 align=center>b r e a d c r u m b s</h3>
<h6 align=center>simple and scalable graph annotation</h6>

<p align=center><img align=center src="https://img.shields.io/badge/all_contributors-3-orange.svg?style=flat-square" /></p>

## Installation

```shell
$ yarn
```

## Running a development server

```shell
$ yarn start
```

This will run a development server in your shell (with linting and transpile outputs), and will automatically open your browser to http://localhost:3000 where it will display the running breadcrumbs app. Saving files to the breadcrumbs filesystem will trigger a rebuild and will restart the server (refreshing your page).

## Usage

### Mouse

| Command | Description |
|---------|-------------|
| <kbd>LMB</kbd> | Click to place a new node (Trace Mode only) |
| <kbd>RMB</kbd> | Drag to pan around the scene. Click to select a node |
| <kbd>MMB</kbd> | Scroll to scrub through the z-stack |

### Keyboard

| Command | Description |
|---------|-------------|
| <kbd>q</kbd>, <kbd>e</kbd> | Pan up and down in the z-stack |
| <kbd>+</kbd>, <kbd>-</kbd> | Zoom in and out |
| <kbd>a</kbd> | Mark the current node as an Axon |
| <kbd>d</kbd> | Mark the current node as a Dendrite |
| <kbd>!</kbd> | Mark the current node as a bookmark, to return to later. (Press again to toggle) |
| <kbd>@</kbd> | Return to the previous bookmark |
| <kbd>delete</kbd> | Delete the currently active node |
| <kbd>esc</kbd> | Reset the zoom and pan of the scene |
| <kbd>T</kbd> | Toggle trace visibility |

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore -->
| [<img src="https://avatars2.githubusercontent.com/u/693511?v=4" width="100px;"/><br /><sub><b>Jordan Matelsky</b></sub>](http://jordan.matelsky.com)<br />[💻](https://github.com/aplbrain/colocar/commits?author=j6k4m8 "Code") [💬](#question-j6k4m8 "Answering Questions") | [<img src="https://avatars0.githubusercontent.com/u/9058954?v=4" width="100px;"/><br /><sub><b>Tucker Chapin</b></sub>](http://tuckerchap.in)<br />[💻](https://github.com/aplbrain/colocar/commits?author=tuckerchapin "Code") | [<img src="https://avatars0.githubusercontent.com/u/7283561?v=4" width="100px;"/><br /><sub><b>Joe Downs</b></sub>](https://github.com/jtpdowns)<br />[💻](https://github.com/aplbrain/colocar/commits?author=jtpdowns "Code") |
| :---: | :---: | :---: |
<!-- ALL-CONTRIBUTORS-LIST:END -->

<p align=center>[<a href="https://github.com/kentcdodds/all-contributors#emoji-key">emoji key</a>]</p>

## Deploying

- **Build the application.**

```shell
yarn build
```

- **Zip the build.**

```shell
zip build.zip build/*
```

- **Upload the build.**

You'll need access to the AWS console in order to do this: Get in touch with a project maintainer.
