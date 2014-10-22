# conkitty-route [![Build Status](https://travis-ci.org/hoho/conkitty-route.svg?branch=master)](https://travis-ci.org/hoho/conkitty-route)

Build a single page application using routing tree.

- [Introduction](#introduction)
    - [Simple example](#simple-example)
    - [More complex example](#more-complex-example)
- [About History API](#about-history-api)
- [URI patterns and parameters](#uri-patterns-and-parameters)
    - [Simple match](#simple-match)
    - [Capture parameters](#capture-parameters)
    - [Optional parameters](#optional-parameters)
    - [Parameters constraints](#parameters-constraints)
- [Frame](#frame)
    - [Frame summary](#frame-summary)
    - [Patterns concatenation](#patterns-concatenation)
    - [Frame settings](#frame-settings)
        - [id](#id)
        - [title](#title)
        - [params](#params)
        - [data](#data)
        - [render](#render)
        - [frames](#frames)
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

We have some URL in browser address string and we want to render the
corresponding DOM.

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

## About History API

`conkitty-route` utilizes History API of the modern browsers. For most of cases
History API will be used automatically. `conkitty-route` adds a click handler
for anchor tags and uses `history.pushState()` to actually change browsers
location. When the location is changed, only a corresponding part of the page
is rerendered. Of course, you can change the location manually, using
[$CR.set()](#crseturi--reload-replace) method.


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


### Parameters constraints

It is possible to add constraints and default values to a parameter, as well as
transform parameter value. [Frame `params`](#params) property aims to do that.


## Frame

### Frame summary

Frame is the key element of the routing tree. The routing tree consists of
Frames (unlimitedly nested). Frame is a pair of URI pattern and a settings
object.

For example:

```js
$CR.add('/frame1', {
    render: 'template1',
    frames: {
        '/frame2': {
            render: 'template2',
            frames: {
                '/frame3': {
                    render: 'template3'
                },
                '/frame4': {
                    render: 'template4'
                }
            }
        }
    }
});
```

Here we have four nested frames.


### Patterns concatenation

URI patterns of nested Frames are concatenated. The example above will work
for `/frame1`, `/frame1/frame2`, `/frame1/frame2/frame3` and
`/frame1/frame2/frame4` in browser address string.


### Frame settings

Frame settings object example:

```js
{
    id: 'page',
    data: '/api/data',
    render: 'page-template'
}
```

Frame settings is an object with the following keys. All of them are optional.


#### id

`String`

Optional used-defined unique Frame identifier. With this identifier you might
obtain Frame runtime object using [$CR.get()](#crgetframeid) method.

Frame runtime objects provide [useful API](#frame-api).

Example:

```js
$CR
    .add('/:param1/test/:param2', {
        id: 'page',
        render: 'test-template'
    })
    .run();
    
alert($CR.get('page').makeURI({param1: 'val1', param2: 'val2'})); // /val1/test/val2
```


#### title

`String`  
`Function`

The document title when Frame is active. If the function is provided, it will be
called every time this Frame becomes active and should return the title. `this`
inside such function will point to the current Frame runtime object.

Example:

```js
$CR
    .add('/?param=:param', {
        id: 'test-id',
        title: function(params) { return 'Test — ' + params.param + ' (' + this.id + ')'; },
        render: 'test-template'
    })
    .run();
    
$CR.set('/?param=Hello'); // The title is `Test — Hello (test-id)` now.
```


#### params

`Object`

When you want to add some constraints to URI parameters or transform URI
parameters values, use `params` setting. `params` setting value should be an
object, where the key is a parameter name and the value is one of the
following:

- `String`, should be strictly equal to this string.
- `RegExp`, should not be undefined and should match this `RegExp`.
- `Array`, should be strictly equal to one of this array items.
- `Function`, the function will receive a value matched by URI pattern and
  should return a processed value or `undefined` in case the value doesn't
  match.


#### data

`String`  
`Function`  
`Promise`  
`Data-description object`  
*Any plain data*  
`Array` of any of previous

Data fetching is an essential part of any application. By this setting, you
can tell what data you need to load for this Frame.

Let's check out the `data` setting value type meanings:

- [`String`](#string)
- [`Function`](#function)
- [`Promise`](#promise)
- [`Data-description object`](#data-description-object)
- [Any plain data](#any-plain-data)
- [`Array` of any of previous](#array-of-any-of-previous)

##### **`String`**

Reversed URI pattern for an AJAX request. Reversed URI pattern means that you
use the same [parametrized patterns](#capture-parameters) which are used for
the URI matching, but parameters references will be substituted with an actual
values. Plus you can refer to parent frames parameters (by adding as many more
colons as many parents you want to go up to).

For example:

```js
$CR
    .add('/:param1', {
        render: 'template1',
        frames: {
            '/:param2?test=:val': {
                data: '/api/:val/get-data?type=::param1&filter=:param2',
                render: 'template2'
            }
        }
    })
    .run();

$CR.set('/hello/world?test=beautiful');
```

In this example, when we go to `/hello/world?test=beautiful`, after `template1`
is rendered, before rendering `template2`, an AJAX request to
`/api/beautiful/get-data?type=hello&filter=world` will be performed.


##### **`Function`**

When you pass a function as the `data` setting value, this function will be
called when the Frame becomes active. It will receive a parameters object as
first argument and `this` will point to Frame runtime object.

The function should return a `Promise` or an actual data.


##### **`Promise`**

You can pass a `Promise` as the `data` setting value.


##### **`Data-description object`**

`Data-description object` is an object to describe data fetching in more
details. With `Data-description object` you can dynamically build an AJAX
request URI, override an AJAX request with some data and postprocess the data.

Full version of `Data-description object` looks like:

```js
{
    uri: String | Function,
    override: Function,
    parse: Function,
    transform: Function
}
```

Every property (except for `uri`) is optional.

When `uri` is a string, it is treated like [reversed URI pattern](#string).

When `uri` is a function, it will be called receiving a parameters object as
the first argument, `this` will point to Frame runtime object.

When `override` function is defined, it will be called receiving a parameters
object as the first argument, `this` will point to Frame runtime object. When
no request to `uri` is needed, the function should return non-undefined value
as the resulting data.

When `parse` function is defined, it will be called to parse a raw
`XMLHttpRequest` data. When `parse` is not defined `JSON.parse()` is used.
`parse` function receives `XMLHttpRequest` `responseText` as the first argument
and `XMLHttpRequest` itself as the second argument. `this` will point to Frame
runtime object.


##### *Any plain data*




##### **`Array`** *of any of previous*




#### render
#### frames
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

Form is a special kind of Frames to handle HTML forms.

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
