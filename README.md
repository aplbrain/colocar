<h1 align="center">colocar</h1>
<p align="center">
<img src="https://img.shields.io/badge/License-Apache2-blue.svg" />
<img src="https://img.shields.io/badge/Extremely Rad-👌-00ddcc.svg" />
<img src="https://img.shields.io/circleci/token/9fc1451c363b10e98a5968202d088b6375016a93/project/github/aplbrain/colocar/master.svg" />
</p>

## Introduction
Welcome to **colocar**! This repository houses a number of React.js- and p5.js-based tools for sparse annotations of three-dimensional (primarily spatial) datasets and complementary tools for validation of those sparse annotations.

These are primarily used through deployment to Amazon Web Services (AWS), but they can also be run locally with ease. In either case, they require access to a spatial database that houses the data to be annotated and a document-oriented database to receive the annotations. In particular, the current production workflow pulls imagery from [the Boss](https://github.com/jhuapl-boss/boss) and pushes annotations to [colocard](https://github.com/aplbrain/colocard).

## Setup
### Preamble: colocorazon
First, one must build the shared libraries, found in colocorazon. This can be done by cd-ing into colocorazon and running `yarn && yarn build`. This will transpile the shared libraries into browser-friendly, old-timey JavaScript.

### Amble: installing dependencies
Next, the apps require pulling modules into their node_modules. At present, this can be done by cd-ing into the app directory and running `yarn`.

### Postamble: with your powers combined!
Finally, with all dependencies built and installed, we are ready to run and deploy our apps.

## Running Locally

## Deploying to AWS

## Directories



<table>
<tr>
    <td>
        <img align=center src="breadcrumbs/logo.png" width=100>
    </td>
    <td>
        <h3 align=center><a href="breadcrumbs/">breadcrumbs</a></h3>
    </td>
    <td>
        <p>Skeleton 'graph' tracing from images</p>
    </td>
</tr>
<tr>
    <td>
        <img align=center src="matchmaker/logo.png" width=100>
    </td>
    <td>
        <h3 align=center><a href="matchmaker/">matchmaker</a></h3>
    </td>
    <td>
        <p>Skeleton 'graph' pairwise visualization</p>
    </td>
</tr>
<tr>
    <td>
        <img align=center src="pointfog/logo.png" width=100>
    </td>
    <td>
        <h3 align=center><a href="pointfog/">pointfog</a></h3>
    </td>
    <td>
        <p>Pointcloud generation from data</p>
    </td>
</tr>
<tr>
    <td>
        <img align=center src="macchiato/logo.png" width=100>
    </td>
    <td>
        <h3 align=center><a href="macchiato/">macchiato</a></h3>
    </td>
    <td>
        <p>forced choice synapse proofreading</p>
    </td>
</tr>
</table>

---

<p align="center"><small>Made with ♥ at <a href="http://www.jhuapl.edu/"><img alt="JHU APL" align="center" src="./apl-logo.png" height="23px"></a></small></p>
