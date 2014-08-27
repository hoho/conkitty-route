# conkitty-route

Call [Conkitty templates](https://github.com/hoho/conkitty) according to
specified routing tree.

## Introduction

The idea is simple. We have some URL in browser's address string and we want to
render corresponding DOM.

Reality makes things a bit harder sometimes. Somewhere in between knowing URL
and rendering DOM, we need to fetch some data. And we probably need to fetch
different data for different parts of URL and render different templates in
different parts of the page. Routing tree might come handy.

`conkitty-route` adds `$C.route` object to `$C` namespace.

The most simple example:

```js
$C.route
    .add('/', {title: 'Welcome', render: 'WelcomeTemplate'})
    .add('/about', {title: 'About', render: 'AboutTemplate'})
    .add(null, {title: 'Not Found', render: 'NotFoundTemplate'})
    .run();
```

In this example we render template named `WelcomeTemplate` for `/` URI and
template named `AboutTemplate` for `/about` URI, setting page title to 
`Welcome` and `About` respectively. For different URIs we render template
named `NotFoundTemplate`.

Templates are being rendered into `document.body` by default.

More complex example (loading some data):

```js
$C.route
    .add('/some', {
        title: 'With Data',
        data: '/api/something',
        render: {
            before: 'LoadingTemplate', // Render before data is loaded.
            success: 'DataTemplate',   // Render after data is successfully loaded.
            error: 'ErrorTemplate'     // Render in case of error.
        }
    })
    .add('/another', {
        title: 'About',
        data: '/api/another',
        render: 'AboutTemplate' // Render after data is successfully loaded (nothing
                                // will be rendered in case of error). 
    })
    .run();
```

In this example, when we open `/some` URI, `LoadingTemplate` renders, AJAX
request to `/api/something` performs, and depending on the result,
`DataTemplate` or `ErrorTemplate` renders. `DataTemplate` or `ErrorTemplate`
render result replaces `LoadingTemplate` result.

Deeper example:

```js
$C.route
    .add('/hello', {
        title: 'Hello',
        render: 'HelloTemplate',
        frames: {
            '?param1=:param': {
                data: '/api/get?what=:param', // We can capture params and use them.
                parent: 'div#param-parent', // CSS selector for parent element to 
                render: 'Param1Template',   // render Param1Template to.
                frames: {
                    '#hash1': {
                        parent: 'div#hashes',
                        render: 'Hash1Template'
                    },
                    '#hash2': {
                        parent: 'div#hashes',
                        render: 'Hash2Template'
                    }
                }
            },
            '?param2=:param': {
                parent: 'div#param-parent',
                render: 'Param2Template'
            },
            '?param3=:param': {
                parent: 'div#param-parent',
                render: 'Param3Template'
            },
            '/deeper?param2=:p&param3=hello': {
                data: '/api/get?what=:p', // Data will be passed to template as first argument.
                parent: 'div#deeper',
                render: 'DeeperTemplate'
            }
        }
    })
    .run();
```

This example will present different combinations of rendered templates for
following URIs:

+ `/hello` — Only `HelloTemplate` will be rendered.
+ `/hello?param1=test` — `HelloTemplate` will be rendered, AJAX request for
  `/api/get?what=test` will be performed, `Param1Template` will be rendered to
  `<div id="param-parent">` node (it should be added by, for example,
  `HelloTemplate` template) in case request is successful.
+ `/hello?param1=test#hash1` and `/hello?param1=test#hash2` — the same to
  previous one, but, in addition, render `Hash1Template` or `Hash2Template` to
  `<div id="hashes">` node in case AJAX request to `/api/get?what=test` is
  successful.
+ `/hello?param2=test2` — `HelloTemplate` will be rendered, `Param2Template`
  will be rendered to `<div id="param-parent">`.
+ `/hello?param3=test3` — `HelloTemplate` will be rendered, `Param3Template`
  will be rendered to `<div id="param-parent">`.
+ `/hello?param1=test1&param2=test2&param3=test3` — `HelloTemplate` will be
  rendered, `Param1Template`, `Param2Template` and `Param3Template` will be
  rendered to `<div id="param-parent">`.
+ `/hello/deeper?param2=world&param3=hello` — `HelloTemplate`, AJAX request to
  `/api/get?what=world`, `DeeperTemplate` to `<div id="deeper">` in case of
  successful request.
+ `/hello/deeper?param1=test&param2=world&param3=hello#hash1` — `HelloTemplate`,
  AJAX request to `/api/get?what=world`, `DeeperTemplate` in case of successful
  request.

You can use unlimited combination of frames. And accepted values for `data` and
`render` are much more variable. You can pass object (no request will be
performed) or Promise or function returning data or function returning Promise
to `data`. You can pass not just template name, but function returning DOM node
as `render`. And much more. Check for API docs below.


## API

### $C.route.add(uri, frame)

#### `uri`

`uri` identifies composition of path, query parameters and hash. It is possible
to remember pieces of path, query parameters values and hash for future use.

`uri` might look like
`/hello/:world?param1=:value1&param2=:?value2#:?hash`.

It will match `/hello/sweetie?param1=piupiu` and
`/hello/honey?param2=pom&param1=pam#ololo`. In first example remembered
parameters look like `{world: 'sweetie', value1: 'piupiu'}`. Parameters for
second example look like
`{world: 'honey', value1: 'pam', value2: 'pom', hash: 'ololo'}`.

To remember piece of path, use `:key`. 
