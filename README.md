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
    .add('/', {title: 'Welcome', action: 'WelcomeTemplate'})
    .add('/about', {title: 'About', action: 'AboutTemplate'})
    .add(null, {title: 'Not Found', action: 'NotFoundTemplate'})
    .run();
```

In this example we render template named `WelcomeTemplate` for `/` URI and
template named `AboutTemplate` for `/about` URI, setting page title to 
`Welcome` and `About` respectively. For different URI paths we render template
named `NotFoundTemplate`.

Templates are being rendered into `document.body` by default.

More complex example (loading some data):

```js
$C.route
    .add('/some', {
        title: 'With Data',
        data: '/api/something',
        action: {
            before: 'LoadingTemplate', // Render before data is loaded.
            success: 'DataTemplate',   // Render after data is successfully loaded.
            error: 'ErrorTemplate'     // Render in case of error.
        }
    })
    .add('/another', {
        title: 'About',
        data: '/api/another',
        action: 'AboutTemplate' // Render after data is successfully loaded (nothing
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
        action: 'HelloTemplate',
        frames: {
            '?param1=:param': {
                data: '/api/get?what=:param', // We can capture params and use them.
                parent: 'div#param-parent', // CSS selector for parent element to 
                action: 'Param1Template',   // render Param1Template to.
                frames: {
                    '#hash1': {
                        parent: 'div#hashes',
                        action: 'Hash1Template'
                    },
                    '#hash2': {
                        parent: 'div#hashes',
                        action: 'Hash2Template'
                    }
                }
            },
            '/deeper?param2=:p&param3=hello': {
                data: '/api/get?what=:p', // Data will be passed to template as first argument.
                parent: 'div#deeper',
                action: 'DeeperTemplate'
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
+ `/hello/deeper?param2=world&param3=hello` — `HelloTemplate`, AJAX request to
  `/api/get?what=world`, `DeeperTemplate` to `<div id="deeper">` in case of
  successful request.
+ `/hello/deeper?param1=test&param2=world&param3=hello#hash1` — `HelloTemplate`,
  AJAX request to `/api/get?what=test`, AJAX request to `/api/get?what=world`,
  `Param1Template`, `Hash1Template` and `DeeperTemplate` in case of successful
  requests.

You can use unlimited combination of frames. And accepted values for `data` and
`action` are much more variable. You can pass object (no request will be
performed) or Promise or function returning data or function returning Promise
to `data`. You can pass not just template name, but function returning DOM node
as `action`. And much more. Check for API docs below.


## API

Pending.
