# conkitty-route [![Build Status](https://travis-ci.org/hoho/conkitty-route.svg?branch=master)](https://travis-ci.org/hoho/conkitty-route)

Build single page application using routing tree.

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


## API

In progress.
