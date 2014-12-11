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
        - [parent](#parent)
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
        - [refresh](#refresh)
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
    - [Frame.params()](#frameparams)
    - [Frame.data(*[index]*)](#framedataindex)
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

`conkitty-route` utilizes History API of the modern browsers. For the most of
cases History API will be used automatically. `conkitty-route` adds a click
handler for the anchor tags and uses `history.pushState()` to actually change
browsers location. When the location is changed, only a corresponding part of
the page is rerendered. Of course, you can change the location manually, using
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

The Frame is the key element of the routing tree. The routing tree consists of
Frames (unlimitedly nested). The Frame is a pair of a URI pattern and a
settings object.

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

Here we have four nested Frames.


### Patterns concatenation

URI patterns of nested Frames are concatenated. The example above will work
for `/frame1`, `/frame1/frame2`, `/frame1/frame2/frame3` and
`/frame1/frame2/frame4` in the browser address string.


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

An optional user-defined unique Frame identifier. With this identifier you
might obtain the Frame runtime object using [$CR.get()](#crgetframeid) method.

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

The document title when the Frame is active. If the function is provided, it
will be called every time this Frame becomes active and should return the title.
The function receives a parameters object as the first argument, `this` will
point to this Frame runtime object.

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

When you want to add some constraints to a URI parameters or transform a URI
parameters values, use `params` setting. `params` setting value should be an
object, where the key is a parameter name and the value is one of the
following:

- `String`, should be strictly equal to this string.
- `RegExp`, should match this `RegExp`.
- `Array`, should be strictly equal to one of this array items.
- `Function`, the function will receive a value matched by a URI pattern and
  should return a processed value (or `undefined` in case the value doesn't
  match).

Example:

```js
$CR
    .add('/?p1=:param1&p2=:param2&p3=:param3&p4=:param4', {
        params: {
            param1: /^(?:val1|val2)$/,
            param2: ['val3', 'val4', 'val5'],
            param3: 'val6',
            param4: function(val) { return val + val; }
        },
        render: 'template1'
    })
    .run();

$CR.set('/?p1=val2&p2=val4&p3=val6&p4=piu');
// A parameters object for the `template1` will look like:
// {param1: 'val2', param2: 'val4', param3: 'val6', param4: 'piupiu'}.
```


#### data

`String`  
`Function`  
`$CR.$.data()`  
`$CR.$.static()`  
`Array` *of any of the previous*

Data fetching is an essential part of any application. With this setting, you
can tell what data you need to load for this Frame.

Let's check out the `data` setting value type meanings:

- [`String`](#string)
- [`Function`](#function)
- [`$CR.$.data()`](#crdata)
- [`$CR.$.static()`](#crstatic)
- [`Array` *of any of the previous*](#array-of-any-of-the-previous)

##### `String`

A reversed URI pattern for an AJAX request. A reversed URI pattern means that
you use the same [parametrized patterns](#capture-parameters) which are used for
the URI matching, but parameter references will be substituted with an actual
values. Plus you can refer to a parent Frames parameters (**parameters object
is inherited from the parent Frame parameters object via prototypical
inheritance**).

For example:

```js
$CR
    .add('/:param1', {
        render: 'template1',
        frames: {
            '/:param2?test=:val': {
                data: '/api/:val/get-data?type=:param1&filter=:param2',
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


##### `Function`

When you pass a function as the `data` setting value, this function will be
called when the Frame becomes active. It will receive a parameters object as
the first argument, `this` will point to the Frame runtime object.

The function should return a `Promise` or an actual data.


##### `$CR.$.data()`

It is possible to customize pretty much everything about the data fetching
process. Use `$CR.$.data()` helper to do that.

`$CR.$.data()` helper accepts a settings object, a full version of which looks
like:

```js
{
    uri: String | Function,
    method: String | Function,
    override: Function,
    parse: Function,
    transform: Function,
    eq: Function
}
```

Every property (except for `uri`) is optional.

When `uri` is a string, it is treated like a [reversed URI pattern](#string).
When `uri` is a function, it will be called with a parameters object as the
first argument, `this` will point to the Frame runtime object. The function
should return an URI for the request.

When `override` function is defined, it will be called with a parameters
object as the first argument, `this` will point to the Frame runtime object.
When no request to `uri` is needed, the function should return a non-undefined
value with the resulting data.

When `parse` function is defined, it will be called to parse a raw
`XMLHttpRequest` response. When `parse` is not defined, `JSON.parse()` is used.
`parse` function receives `responseText` as the first argument and
`XMLHttpRequest` object itself as the second argument, `this` will point to
the Frame runtime object.

When `transform` function is defined, it will be called to transform parsed
data into something else. The function will receive the parsed data as the first
argument, `XMLHttRequest` object as the second argument, `this` will point to
the Frame runtime object. The function should return the transformed data.

When `eq` function is defined, it will be used instead of the default equality
check function for the [automatic refresh](#refresh) functionality. The function
will receive the new data as the first argument and the previous data as the
second argument, `this` will point to the Frame runtime object.


##### `$CR.$.static()`

When you want to attach some static data to the Frame, `$CR.$.static` helper
should be used.

```js
    ...
    data: $CR.$.static([{some: 'static'}, 'data']),
    ...
```


##### `Array` *of any of the previous*

When you have several data sources, you can combine them all into an array.
The Frame processing will continue after all these sources are fetched.


#### parent

`String`  
`Function`  
`Node`

The `parent` setting represents the default parent DOM node for the `render`
setting of this Frame and its child Frames.

When the string is passed, it is used as CSS selector for find actual node.

When the function is passed, it will be called, `this` will point to this
Frame runtime object. The function should return DOM node.

When the Frame itself and all its parent Frames have no `parent` setting,
`document.body` is used.


#### render

`Render object`  
`String`  
`Function`  
`$CR.$.tpl()`  
`$CR.$.uri()`  
`Array` *of any of the previous*

The `render` setting is one of the trickiest and powerful parts of the Frame.
There are five render stages:

- `before` stage happens when the Frame has become active.
- `success` stage happens when the data has been fetched or right after
  `before` stage when the Frame has no data.
- `error` stage happens when an error has occurred during the data-fetching.
- `after` stage happens right after `success` or `error` stage.
- `except` stage happens when an exception has occurred during the stages above.

The DOM rendered on each stage replaces the DOM rendered on the previous stage
(unless you specifically tell not to replace it).


##### `Render object`

`Render object` is an object with stage names as the keys and all other options
(`String`, `Function`, `$CR.$.tpl()`, `$CR.$.uri()`, `Array` of the previous)
as values.

When you use `String`, `Function`, `$CR.$.tpl()`, `$CR.$.uri()` or
`Array` directly as the `render` setting value, **`success` stage is assumed**.

Here is what the full version of `Render object` looks like:

```js
{
    before: AOO,  // AOO — All other options.
    '-before': AOO,
    '+before': AOO,

    success: AOO,
    '-success': AOO,
    '+success': AOO,

    error: AOO,
    '-error': AOO,
    '+error': AOO,

    after: AOO,
    '-after': AOO,
    '+after': AOO,

    except: AOO,
    '-except': AOO,
    '+except': AOO
}
```

`-` before the stage name means that this Frame wasn't active in previous
document location. `+` means that this Frame was active. Here is the example
to understand this:

```js
$CR
    .add('/:param', {
        data: '/api/data',
        render: {
            '-before': 'spinner-template',
            '+before': function() { document.body.style.opacity = 0.5; },
            success: 'page-template',
            error: 'error-template',
            '+after': function() { document.body.style.opacity = 1; }
        }
    })
    .run();

$CR.set('/hello');
// Wait for the data to load.
$CR.set('/world');
```

In this example, after `$CR.set('/hello');` the Frame becomes active for the
first time, there is no DOM for this frame yet. In this case `-before` handler
will work.

After `$CR.set('/world');` the Frame remains active, but we have the previous
DOM already. If we will render the spinner, it will replace the previous DOM
and will cause the page to blink, so we just change the opacity instead.


##### `String`

The string will be interpreted as a template name, this name will be passed to
`callTemplate` callback of the [$CR.run()](#crrundefaults) method settings.


##### `Function`

The function will be called, `this` will point to this Frame, arguments are
depending on the stage (basically, the first argument is a data, the second
argument is a parameters object, the third argument is a form node, in case it
is a Form). The function should return a string (this string will be used as a
template name), a DOM node (this node, will be inserted into the document). The
function could also return `false` (to stop calling the next handlers for this
stage, see `Array` description below) and `undefined` (nothing will happen to
the document, sometimes you just need to call a function).


##### `$CR.$.tpl(name, parent, replace)`

To customize the template call result, `$CR.$.tpl` helper should be used.

```js
    ...
    render: $CR.$.tpl(
        String | Function, // Template name, the same to the descriptions above.
        String | Function | Node, // Personal parent for the result.
        false // Do not replace the DOM from the previous stage, `true` by default.
    ),
    ...
```


##### `$CR.$.uri(uri, params, reload, replace)`

Sometimes, a location change is needed as the result of the Frame processing.
This is true for the forms mostly, but could be used everywhere.

`uri` is a string (reversed URI pattern) or a function (should return URI).

`params` is a parameters object or a function that returns a parameters object
(in case `uri` is a reversed URI pattern, ignored otherwise).

`reload` and `replace` have the same meaning
[$CR.set()](#crseturi--reload-replace) method has.


##### `Array` *of any of the previous*

`String`s, `Function`s, `$CR.$.tpl()`s and `$CR.$.uri()`s can be combined into
an array, they will be handled one after another corresponding to the
descriptions above.


#### frames

`Object`

To mount root Frame, [$CR.add()](#cradduri-frame) method should be used.
The `frames` setting is corresponding for mounting child frames:

```js
$CR.add('/', {
    frames: {
        '/welcome': {
            render: 'template1',
            frames: {
                '/my/love': {render: 'template2'}
            }
        },
        '/about': {render: 'template3'}
    }
});
```


#### matcher

`Function`

By default, the Frame becomes active when the URI pattern matches the location.
If you need more complex logic to determine if the Frame is active, you can
use the `matcher` function. This function will be called if the URI pattern
matches the location, before Frame processing. The function will receive a
parameters object as the first argument, `this` will point to this Frame. The
function should return `true` if the Frame should become active, `false`
otherwise.

Example:

```js
$CR
    .add('/:param', {
        matcher: function(params) { return Math.random() < 0.5; },
        render: 'template1'
    })
    .add(null, {render: 'not-found'})
    .run();

$CR.set('/piupiu'); // `template1` will be rendered one time out of two.
```


#### break

`Boolean`  
`Function`

The Frame matching process works the following way. The matcher checks the
root Frames one after another. If there is a match in one of the root Frames,
this root Frame becomes active with all matched child Frames.

The `break` setting allows you to stop the following child Frames matching
(something very similar to `switch` clause in JavaScript).

If the `break` setting is a function, this function will be called, `this` will
point to this Frame, the function should return `true` or `false`.

Example:

```js
$CR
    .add('/', {
        render: 'template1',
        frames: {
            '/?param1=val1&param2=val2': {render: 'template2'},
            '/?param1=val1': {render: 'template3'},
            '/?param2=val2': {render: 'template4'}
        }
    })
    .run();

$CR.set('/?param1=val1&param2=val2');
```

In this example, when we open `/?param1=val1&param2=val2`, all three child
Frames will become active.

But if we add `break: true` to the first child Frame:

```js
$CR
    .add('/', {
        render: 'template1',
        frames: {
            '/?param1=val1&param2=val2': {render: 'template2', break: true},
            '/?param1=val1': {render: 'template3'},
            '/?param2=val2': {render: 'template4'}
        }
    })
    .run();

$CR.set('/?param1=val1&param2=val2');
```

Only the first child Frame will be processed now.


#### keep

`Boolean`

By default, when you call [`$CR.set()`](#crseturi--reload-replace) without
`reload` argument or when you click a link (`conkitty-route` catches clicks for
the anchor elements and uses `$CR.set()` internally), only the Frames that have
changed will be rerendered.

You can add `keep: false` setting to force the Frame to be rerendered every
time.

Example:

```js
$CR
    .add('/', {
        render: 'template1',
        frames: {
            '/sub': {
                data: '/api/data',
                render: 'template2'
            }
        }
    })
    .run();

$CR.set('/sub'); // `/api/data` is loaded, `template2` is rendered.
$CR.set('/sub'); // Nothing happens.
```

But if we add `keep: false`:

```js
$CR
    .add('/', {
        render: 'template1',
        frames: {
            '/sub': {
                data: '/api/data',
                render: 'template2',
                keep: false
            }
        }
    })
    .run();

$CR.set('/sub'); // `/api/data` is loaded, `template2` is rendered.
$CR.set('/sub'); // `/api/data` is loaded again, `template2` is rendered again.
```


#### final

`Boolean`

By default, any Frame can become the final Frame (when the Frame matches the
location and its child Frames don't match the location).

You can add `final: false` setting to deny this Frame to be the final one.

Example:

```js
$CR
    .add('/', {
        render: 'template1',
        frames: {
            '/sub': {
                render: 'template2'
            }
        }
    })
    .add(null, {render: 'not-found'})
    .run();

$CR.set('/sub'); // `template1` and `template2` are rendered.
$CR.set('/'); // Just `template1`.
```

But if we add `final: false`:

```js
$CR
    .add('/', {
        final: false,
        render: 'template1',
        frames: {
            '/sub': {
                render: 'template2'
            }
        }
    })
    .add(null, {render: 'not-found'})
    .run();

$CR.set('/sub'); // `template1` and `template2` are rendered.
$CR.set('/'); // `not-found` is rendered.
```


#### wait

`Boolean`

By default, the `success` stage happens as soon as possible (right after the
data is fetched or right after the `before` stage when no data is needed).

You can delay `success` stage till all matched child Frames are ready for the
`success` stage. Just add `wait: true`. You can cancel the delay deeper by
adding `wait: false`.

Example:

```js
$CR
    .add('/', {
        wait: true,
        data: '/api/data1',
        render: 'template1',
        frames: {
            '/sub': {
                data: '/api/data2',
                render: 'template2',
                frames: {
                    '/sub2': {
                        wait: false,
                        data: '/api/data3',
                        render: 'template3'
                    }
                }
            }
        }
    })
    .run();

$CR.set('/sub/sub2'); // `template1` and `template2` will be rendered only
                      // after `/api/data1` and `/api/data2` are loaded.
                      // `/sub2` Frame has `wait: false`, it will be rendered
                      // later, when `/api/data3` is loaded.
```


#### reduce

`Boolean`

By default, each child Frame URI pattern takes its bite of the location.
Sometimes we want to take a piece of location just to have some status in a
parameters object. If you add `reduce: false`, the Frame will not take its
bite of the location from the child Frames and will not take a part in
[`$CR.makeURI()`](#crmakeuriuri--params) and
[`Frame.makeURI()`](#framemakeuriparams) functions.

Example:

```js
$CR
    .add('/', {
        render: 'template1',
        frames: {
            '/:?item': { // Optional parameter, could be used to get the current item to highlight it.
                reduce: false,
                render: 'items',
                frames: {
                    '/:item': {render: 'item-details'},
                    '/': {render: 'no-item-selected'}
                }
            }
        }
    })
    .run();

$CR.set('/item'); // `template1`, `items` and `item-details` are rendered.
$CR.set('/'); // `template1`, `items` and `no-item-selected` are rendered.
```


#### form

`Form settings object`  
Array of `Form settings objects`

Use the `form` setting when the Frame has an HTML form that needs to be
processed. `conkitty-route` will intercept a `submit` event and process the
form according to [Form settings](#form-settings).

Example:

```js
$CR
    .add('/:param', {
        render: 'template1',
        form: {
            match: '.selector', // Optional matcher, if present, the form will
                                // be processed in case the form's DOM node
                                // matches the selector.
            action: '/api/:param',
            method: 'post',
            render: 'template2'
        }
    })
    .run();

$CR.set('/piu'); // `template1` will be rendered (it should have an HTML form).
                 // After the form is submitted, an AJAX request to `/api/piu`
                 // will be performed, and the DOM of this Frame will be
                 // replaced with `template2`.
```


#### on

`Object`

You can use [`$CR.on()`](#cronevent-handler--frameid) method to bind an event
handlers and you can bind an event handlers right from the Frame declaration.

Example:

```js
$CR
    .add('/', {
        id: 'frame1',
        render: 'template1',
        on: {
            before: function() { alert(this.id + ' before'); },
            success: [function() { alert(this.id + ' success1'); }, function() { alert(this.id + ' success2'); }],
            after: function() { alert(this.id + ' after'); }
        }
    });
```


#### refresh

`Number`

*Experimental*. A timeout for a background refresh. After this timeout since
the previous data was fetched, `conkitty-route` will rerequest the Frame data
and silently rerender the Frame in case the data is changed. Only successful
attempts to fetch the data will be considered and only `success` and `after`
render stages will be called. You can customize the data equality check
function using `$CR.$.data()` helper.


## Form

### Form summary

The Form is a special kind of the Frame to handle HTML forms.

### Form settings

#### title

The same to the [Frame settings `title`](#title), shows up when the form is
submitted.


#### action

`String`  
`Function`  
`$CR.$.data()`  
`$CR.$.static()`

When you don't provide the `action` attribute for the form DOM node, this
`action` setting is used.

When the `action` setting is a string, it's a reversed URI pattern (the same
to the [Frame `data` setting](#data)).

When the `action` setting is a function, this function will be called, the
first argument is a serialized form data, the second argument is this Form
parent Frame runtime object, `this` will point to the DOM node of the form.
The function should return the data of the submission result.

`$CR.$.data()` and `$CR.$.static()` have the same meaning the Frame has.


#### method

`String`

When you don't provide the `method` attribute for the form DOM node, this
`method` setting is used.


#### check

`Function`

Provide this function if you need to validate the form before the submission.
This function will be called for every field during the form submission or when
you manually call [Frame.checkForm()](#framecheckformnode) method.

The function receives the field DOM node as the first argument, the value as
the second argument and the whole form serialized data as the third argument.
`this` will point to the form Frame runtime object.

The function should return an error message in case the value is invalid,
`false` otherwise.

Example:

```js
$CR
    .add('/', {
        render: 'template1',
        form: {
            action: '/api/form',
            check: function(elem, val, data) {
                return Math.random() < 0.5 'The Fortune errors this field' : false;
            },
            render: 'template2'
        }
    });
```


#### state

`Function`

The form field has three states: `valid`, `invalid` and `sending`. By default,
the fields get disabled when the form is in `sending` state.

You can provide a custom field state changer.

The function receives the field DOM node as the first argument, the state (one
of three states above) and an error message from the `check` function as the
third argument. `this` will point to the form Frame runtime object.

The function should return `undefined` when you don't want to cancel the
default action (disabling fields in `sending` state), something else otherwise.


Example:

```js
$CR
    .add('/', {
        render: 'template1',
        form: {
            action: '/api/form',
            check: function(elem, val, data) {
                return Math.random() < 0.5 'The Fortune errors this field' : false;
            },
            state: function(elem, state, msg) {
                switch (state) {
                    case 'valid': elem.className = ''; break;
                    case 'invalid': elem.className = 'invalid'; alert(msg); break;
                    case 'sending': elem.className = 'sending'; break;
                }
            },
            render: 'template2'
        }
    });
```


#### type

`String`

By default, the form data is sent in the urlencoded form format (with
`application/x-www-form-urlencoded` content type).

Set to `text` when you want to submit the form data as plain text (with
`text/plain` content type).
Set to `json` when you want to submit the form data as JSON (with
`application/json` content type).


#### submit

`Function`

Use this function to preprocess the data before the submission or to cancel the
submission.

This function receives the form data as the first argument, the form Frame
runtime object as the second argument, cancel function as the third argument.
`this` will point to the DOM node of the form.

The function should return an actual data to send or call cancel function.

Example:

```js
$CR
    .add('/', {
        render: 'template1',
        form: {
            action: '/api/form',
            type: 'json',
            submit: function(data, frame, cancel) {
                // Use `cancel()` to cancel the submission.
                return {values: data.map(function(item) { return item.value; })};
            },
            render: 'template2'
        }
    });
```


### xhr

`Function`

Use this function to set additional headers for the form XMLHttpRequest object.

This function receives XMLHttpRequest object as the first argument, the form
data as the second argument, the form Frame runtime object as the third
argument. `this` will point to the DOM node of the form.


#### render

The same to the [Frame `render`](#render). The result will be rendered instead
of the form parent Frame DOM.


## API

### $CR.add(uri, frame)

Mount a root Frame.

- `uri` — an URI pattern.
- `frame` — a settings object.


### $CR.run(*[defaults]*)

### $CR.get(frameId)

Get the Frame runtime object.

- `frameId` — an [identifier](#id).


### $CR.set(uri *[, reload, [replace]]*)

Set the current location.

- `uri` — a new location.
- `reload` *(optional)* — `conkitty-route` doesn't reload the Frame data and
  doesn't rerender the Frame, when no corresponding to the Frame URI part is
  changed. By passing `true` you can force the Frame to be reloaded.
- `replace` *(optional)* — by default, each `$CR.set()` method call adds a
  record to the browser history. Pass `true` to replace the current history
  position instead of creating the new one.


### $CR.on(event, handler *[, frameId]*)

Bind an event handler.

- `event` — an event name or space-separated set of event names.
- `handler` — an event handler.
- `frameId` *(optional)* — an [identifier](#id) (when the handler should be
  called for the specific Frame only).

There are per-Frame events:

- `before` — the Frame has become active.
- `success` — when the data is loaded (or right after `before` when there is no
  data).
- `error` — when an error has occurred during loading the data.
- `after` — after `success` or `error` event.
- `leave` — the Frame has stopped to be active.
- `stop` — the location has changed before the Frame data is loaded.
- `except` — an exception has occurred during processing the Frame.

There are meta events:

- `busy` — when some data has started to load.
- `idle` — when all the datas have been loaded.


### $CR.off(event, handler *[, frameId]*)

Unbind an event handler.

The arguments are the same to [`$CR.on()`](#cronevent-handler--frameid) method
arguments.


### $CR.makeURI(uri *[, params]*)

Build an URI from URI pattern an a paremeters object.

- `uri` — an URI pattern.
- `params` — a parameters object.

Example:

```js
$CR.makeURI('/hello/:world?arg=:ololo', {world: 'piu', ololo: ['11', '22']});
// '/hello/piu?arg=11&arg=22'
```


### $CR.params()

Get the current location query string params by their actual names.

Example:

```js
$CR.set('/hello?world=beautiful&yes=truly&yes=indeed');
console.log($CR.params());
// {world: 'beautiful', yes: ['truly', 'indeed']}
```


### $CR.serializeForm(node *[, withFields]*)


## Frame API

### Frame.params()

Get the parameters object from the Frame runtime object.


### Frame.data(*[index]*)

### Frame.makeURI(*[params]*)

### Frame.active(*[andPrev]*)

### Frame.reload()

### Frame.checkForm(node)
