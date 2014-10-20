# conkitty-route [![Build Status](https://travis-ci.org/hoho/conkitty-route.svg?branch=master)](https://travis-ci.org/hoho/conkitty-route)

Build single page application using routing tree.

- [Introduction](#introduction)
    - [Simple example](#simple-example)
    - [More complex example](#more-complex-example)
- [URI parts and parameters](#uri-parts-and-parameters)
- [Frame](#frame)
    - [Frame summary](#frame-summary)
    - [Frame settings](#frame-settings)
        - [id](#id)
        - [title](#title)
        - [params](#params)
        - [data](#data)
        - [render](#render)
        - [matcher](#matcher)
        - [break](#break)
        - [keep](#keep)
        - [final](#final)
        - [wait](#wait)
        - [reduce](#reduce)
        - [form](#form)
        - [on](#on)
- [Form](#form)
    - [Form summary](#form-summary)
    - [Form settings](#form-settings)
        - [title](#title-1)
        - [action](#action)
        - [method](#method)
        - [check](#check)
        - [state](#state)
        - [type](#type)
        - [submit](#submit)
        - [render](#render-1)
- [API](#api)
    - [$CR.add(uri, frame)](#cradduri-frame)
    - [$CR.run(*[defaults]*)](#crrundefaults)
    - [$CR.get(frameId)](#crgetframeid)
    - [$CR.set(uri *[, reload, [replace]]*)](#crseturi--reload-replace)
    - [$CR.on(event, handler *[, frameId]*)](#cronevent-handler--frameid)
    - [$CR.off(event, handler *[, frameId]*)](#croffevent-handler--frameid)
    - [$CR.makeURI(uri *[, params]*)](#crmakeuriuri--params)
    - [$CR.params()](#crparams)
    - [$CR.serializeForm(node *[, withFields]*)](#crserializeformnode--withfields)
- [Frame API](#frame-api)
    - [Frame.params(*[parent]*)](#frameparamsparent)
    - [Frame.data(*[index, [parent]]*)](#framedataindex-parent)
    - [Frame.makeURI(*[params]*)](#framemakeuriparams)
    - [Frame.active(andPrev)](#frameactiveandprev)
    - [Frame.reload()](#framereload)
    - [Frame.checkForm(node)](#framecheckformnode)


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

## URI parts and parameters


## Frame

### Frame summary

Frame is the key element of the routing tree. The routing tree consists of
frames. Frame is a pair of corresponding piece of URI and an object.


### Frame settings

#### id
#### title
#### params
#### data
#### render
#### matcher
#### break
#### keep
#### final
#### wait
#### reduce
#### form
#### on


## Form

### Form summary

Form is a special kind of frames to handle HTML forms.

### Form settings

#### title
#### action
#### method
#### check
#### state
#### type
#### submit
#### render


## API

### $CR.add(uri, frame)

### $CR.run(*[defaults]*)

### $CR.get(frameId)

### $CR.set(uri *[, reload, [replace]]*)

### $CR.on(event, handler *[, frameId]*)

### $CR.off(event, handler *[, frameId]*)

### $CR.makeURI(uri *[, params]*)

### $CR.params()

### $CR.serializeForm(node *[, withFields]*)


## Frame API

### Frame.params(*[parent]*)

### Frame.data(*[index, [parent]]*)

### Frame.makeURI(*[params]*)

### Frame.active(*[andPrev]*)

### Frame.reload()

### Frame.checkForm(node)
