# conkitty-route

Build single page application according to specified routing tree.

## Introduction

We have some URL in browser's address string and we want to render
corresponding DOM.

Reality makes things a bit harder sometimes. Somewhere in between knowing URL
and rendering DOM, we need to fetch some data. And we probably need to fetch
different data for different parts of URL and render different pieces of DOM in
different parts of the page.

`conkitty-route` aims to give a simple way to create single page application.

Simple example:

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

More complex example:

```js
// Penging.
```


## API

In progress.
