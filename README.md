# conkitty-route [![Build Status](https://travis-ci.org/hoho/conkitty-route.svg?branch=master)](https://travis-ci.org/hoho/conkitty-route)

Build a single page application using routing tree.

- [Introduction](#introduction)
    - [Simple example](#simple-example)
    - [More complex example](#more-complex-example)
- [URI patterns and parameters](#uri-patterns-and-parameters)
    - [Simple match](#simple-match)
    - [Capture parameters](#capture-parameters)
    - [Optional parameters](#optional-parameters)
    - [Patterns concatenation](#patterns-concatenation)
    - [Parameters constraints](#parameters-constraints)
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
the corresponding DOM.

Reality makes things a bit harder sometimes. Somewhere in between knowing URL
and rendering the DOM, we need to fetch some data. And we need to change the DOM
and fetch a new data when the URI is changed or the HTML form is submitted.

`conkitty-route` gives a simple way to create the single page application.


### Simple example

```js
$CR
    .add('/', {title: 'Welcome', render: 'WelcomeTemplate'})
    .add('/about', {title: 'About', render: 'AboutTemplate'})
    .add(null, {title: 'Not Found', render: 'NotFoundTemplate'})
    .run();
```

In this example we render the template named `WelcomeTemplate` for `/` URI and
the template named `AboutTemplate` for `/about` URI, setting the page title to 
`Welcome` and `About` respectively. For other URIs we render the template
named `NotFoundTemplate`. By default,
[Conkitty templates](https://github.com/hoho/conkitty) are used, but you can
customize the template caller and use `conkitty-route` with any template engine
you want.


### More complex example

```js
// Pending.
```

## URI patterns and parameters

### Simple match

Pattern `/path/to/something?arg1=value1&arg2=value2#somehash` matches
any URI with a pathname equals to `/path/to/something`, any query string having
`arg1` and `arg2` arguments with exact `value1` and `value2` values,
any number of other query string arguments and a hash equals to `somehash`.

Pattern `/path/to/something` matches any URI with a pathname equals to
`/path/to/something`, any query string and any hash.


### Capture parameters

`/:path/:to/:something?arg1=:value1&arg2=:value2#:hash` matches any URI
with three components in pathname, any query string with `arg1` and `arg2`
arguments with any values and any hash. Matcher captures URI components by
corresponding names.

For example, the pattern above will match the following URI:
`/hello/beautiful/world?arg1=it&arg2=is&arg3=pretty&arg1=amazing#indeed`
and captured parameters will be:

```js
{
    path:      'hello',
    to:        'beautiful',
    something: 'world',
    arg1:      ['it', 'amazing'],
    arg2:      'is'
}
```

Another example. Pattern `/test/:p/pattern` will match the following URI (with
or without query string and hash): `/test/this/pattern?some=arg#yo`, with one
captured parameter:

```js
{
    p: 'this'
}
```


### Optional parameters

It is possible to specify an optional parameters.

Pattern `/some/:?optional/params?arg1=:?a#:?h` matches
`/some/uri/params?arg1=val1#haha` and `/some/params`. In the first case
parameters will be:

```js
{
    optional: 'uri',
    a:        'val1',
    h:        'haha'
}
```

The last case will not have captured parameters.


### Patterns concatenation



### Parameters constraints



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
