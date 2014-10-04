# conkitty-route [![Build Status](https://travis-ci.org/hoho/conkitty-route.svg?branch=master)](https://travis-ci.org/hoho/conkitty-route)

Build single page application using routing tree.

- [Introduction](#introduction)
    - [Simple example](#simple-example)
    - [More complex example](#more-complex-example)
- [Frame](#frame)
- [Form](#form)
- [API](#api)
    - [$CR.add(uri, frame)](#cradduri-frame)
    - [$CR.run(*[defaults]*)](#crrundefaults)
    - [$CR.get(frameId)](#crgetframeid)
    - [$CR.set(uri*[, reload, [replace]]*)](#crseturi-reload-replace)
    - [$CR.on(event, handler*[, frameId]*)](#cronevent-handler)
    - [$CR.off(event, handler*[, frameId]*)](#croffevent-handler)
    - [$CR.makeURI(uri*[, params]*)](#crmakeuriuri-params)
    - [$CR.params()](#crparams)
    - [$CR.serializeForm(node*[, withFields]*)](#crserializeformnode-withfields)
- [Frame API](#frame-api)
    - [Frame.params()](#frameparams)
    - [Frame.data()](#framedata)
    - [Frame.makeURI(*[params]*)](#framemakeuriparams)
    - [Frame.active()](#frameactive)
    - [Frame.reload()](#framereload)
- [Form API](#form-api)
    - [Form.checkForm(data)](#formcheckformdata)


## Introduction

We have some URL in browser's address string and we want to render
corresponding DOM.

Reality makes things a bit harder sometimes. Somewhere in between knowing URL
and rendering DOM, we need to fetch some data. And we need to change DOM and
fetch new data when URI is changed or HTML form is submitted.

`conkitty-route` gives simple way to create single page application.

### Simple example

```js
$CR
    .add('/', {title: 'Welcome', render: 'WelcomeTemplate'})
    .add('/about', {title: 'About', render: 'AboutTemplate'})
    .add(null, {title: 'Not Found', render: 'NotFoundTemplate'})
    .run();
```

In this example we render template named `WelcomeTemplate` for `/` URI and
template named `AboutTemplate` for `/about` URI, setting page title to 
`Welcome` and `About` respectively. For other URIs we render template
named `NotFoundTemplate`. By default,
[Conkitty templates](https://github.com/hoho/conkitty) are used, but you can
customize template caller and use `conkitty-route` with any template engine you
want.

### More complex example

```js
// Pending.
```

## Frame


## Form


## API

### $CR.add(*uri, frame*)

### $CR.run(*[defaults]*)

### $CR.get(*frameId*)

### $CR.set(*uri[, reload, [replace]]*)

### $CR.on(*event, handler[, frameId]*)

### $CR.off(*event, handler[, frameId]*)

### $CR.makeURI(*uri[, params]*)

### $CR.params()

### $CR.serializeForm(*node[, withFields]*)


## Frame API

### Frame.params()

### Frame.data()

### Frame.makeURI(*[params]*)

### Frame.active()

### Frame.reload()


## Form API

### Form.checkForm(*data*)
