/*!
 * conkitty-route v0.1.0, https://github.com/hoho/conkitty-route
 * (c) 2014 Marat Abdullin, MIT license
 */

/* global $C */
/* global $H */
$C.route = (function(document, decodeURIComponent, encodeURIComponent, undefined) {
    'use strict';

    var defaultTitle,
        defaultRender,
        defaultParent,

        running,

        currentQueryParams,
        currentRoutes = {},

        reloadCurrent,

        routes = [],
        routesFlat,
        routeId = 0,

        routeById = {},

        notFoundRoute,

        oldDOM = [],

        eventHandlers = {
            before: {},
            success: {},
            error: {},
            after: {},
            stop: {},
            except: {},
            leave: {},
            busy: {},
            idle: {}
        },

        busy = false,
        busyCount = 0,
        busyTimer,

        whitespace = /[\x20\t\r\n\f]+/,
        routeNodeKey = '_$Croute',
        dataSourceKey = 'dataSource',

        FORM_STATE_VALID = 'valid',
        FORM_STATE_INVALID = 'invalid',
        FORM_STATE_SENDING = 'sending',

        STR_BEFORE = 'before',
        STR_SUCCESS = 'success',
        STR_ERROR = 'error',
        STR_AFTER = 'after',
        STR_EXCEPT = 'except',

        RENDER_KEYS = [STR_BEFORE, STR_SUCCESS, STR_ERROR, STR_AFTER, STR_EXCEPT],

        NULL = null,

        STR_SUBMIT = 'submit',

        proto = Route.prototype,

        API = function add(uri, frame) {
            checkRunning();
            if (isString(uri) && isString(frame)) {
                // It's a rewrite.
                $H.on(uri, frame);
            } else {
                if (uri) {
                    addRoute(uri, frame);
                } else if (!notFoundRoute) {
                    // NotFound route needs to be last, we'll add it in
                    // run() method.
                    notFoundRoute = frame;
                }
            }
            return API;
        };


    API.add = API;


    API.set = function set(uri, reload) {
        checkRunning(true);
        reloadCurrent = reload;
        return $H.go(uri);
    };


    API.run = function run(defaults) {
        checkRunning();

        defaults = defaults || {};

        defaultTitle = defaults.title || '';
        defaultRender = normalizeRender(defaults.render);
        defaultParent = defaults.parent || document.body;

        if (notFoundRoute) {
            addRoute(undefined, notFoundRoute);
        }

        $H.on(undefined, function() {
            var newRootRoute,
                newRoutes = {},
                i,
                j,
                route,
                froute,
                flat;

            for (i = 0; i < routes.length; i++) {
                route = routes[i];
                if (route._a) {
                    newRootRoute = route;
                    flat = route._flat;
                    for (j = 0; j < flat.length; j++) {
                        froute = flat[j];
                        if (froute._a) {
                            newRoutes[froute._id] = froute;
                        }
                    }
                    break;
                }
            }

            for (i in currentRoutes) {
                route = currentRoutes[i];
                if (!(i in newRoutes) ||
                    reloadCurrent ||
                    !route._s ||
                    route.keep === false ||
                    route._dataError)
                {
                    unprocessRoute(route);
                }
            }

            currentRoutes = newRoutes;
            reloadCurrent = undefined;

            if (newRootRoute) {
                new ProcessRoute(newRootRoute);
            }
        });

        API.on('before after stop', function(e) {
            busyCount += e === STR_BEFORE ? 1 : -1;
            if (busyTimer) { clearTimeout(busyTimer); }
            busyTimer = setTimeout(function() {
                e = busy;
                busy = !!busyCount;
                busyTimer = undefined;
                if (e !== busy) {
                    // Busy state has changed, emit event.
                    emitEvent(busyCount ? 'busy' : 'idle', API);
                }
            }, 0);
        });

        document.body.addEventListener('click', function(e) {
            var elem = e.target;
            while (elem && !(elem instanceof HTMLAnchorElement)) {
                elem = elem.parentNode;
            }
            if (elem && (elem.host === location.host)) {
                e.preventDefault();
                API.set(elem.href);
            }
        }, false);

        document.body.addEventListener(STR_SUBMIT, function(e) {
            var target = e.target,
                formNode = target,
                route,
                form,
                data,
                action;

            while (target) {
                if (((route = target[routeNodeKey])) && ((form = route.form))) {
                    e.preventDefault();
                    data = serializeForm(formNode);

                    currentRoutes[form._id] = form;
                    form._n = route._n;
                    form._f = data[1];

                    if (form.checkForm((data = data[0]))) {
                        unprocessRoute(form, true);
                        form[dataSourceKey] = isFunction((action = formNode.getAttribute('action') || form.action)) ?
                            action.call(formNode, data, route)
                            :
                            action;
                        form.method = formNode.getAttribute('method') || form._method;
                        /* eslint no-loop-func: 0 */
                        setFormState(route, form, FORM_STATE_SENDING);
                        new ProcessRoute(
                            form,
                            formNode,
                            function(xhr/**/, type, submit, ret, i, param) {
                                type = form.type;
                                xhr.setRequestHeader(
                                    'Content-Type',
                                        type === 'text' ?
                                        'text/plain'
                                        :
                                        (type === 'json' ?
                                            'application/json'
                                            :
                                            'application/x-www-form-urlencoded')
                                );

                                data = (submit = form[STR_SUBMIT]) ?
                                    submit.call(formNode, data, xhr, route)
                                    :
                                    data;

                                if (type === 'json') {
                                    return JSON.stringify(data);
                                } else if (data) {
                                    if (type === 'text') {
                                        return data + '';
                                    } else {
                                        ret = [];
                                        for (i = 0; i < data.length; i++) {
                                            param = data[i];
                                            ret.push(encodeURIComponent(param.name) + '=' + encodeURIComponent(param.value));
                                        }
                                        return ret.join('&');
                                    }
                                }
                            }
                        );
                    }

                    break;
                }
                target = target.parentNode;
            }
        });

        running = true;
        $H.run();
    };


    API.on = function on(event, handler, route) {
        var i = '',
            handlers,
            currentHandlers;

        if (isString(event) && isFunction(handler)) {
            event = event.split(whitespace);
            if (event.length === 1) {
                if ((handlers = eventHandlers[event])) {
                    if (route) {
                        if ((i = routeById[route])) { route = i; }
                        i = route._id;
                    }
                    if (!((currentHandlers = handlers[i]))) {
                        currentHandlers = handlers[i] = [];
                    }
                    currentHandlers.push(handler);
                }
            } else {
                for (i = event.length; i--;) {
                    API.on(event[i], handler, route);
                }
            }
        }
        return API;
    };


    API.off = function off(event, handler, route) {
        var i = '',
            currentHandlers;

        if (isString(event) && isFunction(handler)) {
            event = event.split(whitespace);
            if (event.length === 1) {
                if (route) {
                    if ((i = routeById[route])) { route = i; }
                    i = route._id;
                }
                if (((currentHandlers = eventHandlers[event])) &&
                    ((currentHandlers = currentHandlers[i])))
                {
                    for (i = currentHandlers.length; i--;) {
                        if (currentHandlers[i] === handler) {
                            currentHandlers.splice(i, 1);
                        }
                    }
                }
            } else {
                for (i = event.length; i--;) {
                    API.on(event[i], handler, route);
                }
            }
        }
        return API;
    };


    API.get = function get(id) {
        return routeById[id];
    };


    proto.reload = function() {
        var self = this,
            parent;

        if (self._id in currentRoutes) {
            parent = self.parent;
            while (parent) {
                // Check if none of parent routes is in progress.
                if (parent._data instanceof ProcessRoute) {
                    break;
                }
                parent = parent.parent;
            }
            if (!parent) {
                unprocessRoute(self, true);
                new ProcessRoute(self);
            }
        }
    };


    proto.params = function(parent) {
        var p = this;
        parent = parent || 0;
        while (p && parent > 0) {
            p = p.parent;
            parent--;
        }

        return p && p._p || undefined;
    };


    proto.data = function(parent) {
        var p = this,
            d;
        parent = parent || 0;
        while (p && parent > 0) {
            p = p.parent;
            parent--;
        }
        d = p && p._data;
        return isArray(d) ? (isArray(this[dataSourceKey]) ? d : d[0]) : undefined;
    };


    proto.makeURI = function(params) {
        return makeURI(this, this.uri, params || {});
    };


    proto.active = function() {
        return this._id in currentRoutes;
    };


    proto.checkForm = function(data) {
        var self = this,
            fields = self._f || [],
            i,
            route = self.parent,
            check = self.check,
            field,
            error,
            hasError;

        for (i = 0; i < fields.length; i++) {
            field = fields[i];
            error = check ? check.call(route, field[0], field[1], data) : undefined;
            setFieldState(
                route,
                self,
                field,
                error ? ((hasError = true), FORM_STATE_INVALID) : FORM_STATE_VALID,
                error
            );
        }

        return !hasError;
    };


    function setFieldState(route, form, field, stateValue, msg) {
        var state = form.state,
            input = field[0],
            s = state ? state.call(route, input, stateValue, msg) : undefined,
            oldState = field[2];

        field[2] = stateValue;

        if (s === undefined) {
            if (stateValue === FORM_STATE_VALID) {
                if (oldState === FORM_STATE_SENDING) {
                    input.disabled = false;
                }
            }

            // No default action for invalid field.

            if (stateValue === FORM_STATE_SENDING) {
                if (input.disabled) {
                    field[2] = oldState;
                } else {
                    input.disabled = true;
                }
            }
        }
    }


    function setFormState(route, form, state) {
        var fields = form._f,
            i;

        for (i = 0; i < fields.length; i++) {
            setFieldState(route, form, fields[i], state);
        }
    }


    // To avoid multiple parsing of query params for each route, parse them
    // once here.
    $H.on(
        {
            search: function(search/**/, i, j, name, value, cur, flat) {
                // Reset active flags.
                for (i = routes.length; i--;) {
                    cur = routes[i];
                    flat = cur._flat;
                    for (j = flat.length; j--;) {
                        flat[j]._a = 0;
                    }
                }

                // Parse querystring.
                currentQueryParams = {};
                search = search.split('&');
                for (i = 0; i < search.length; i++) {
                    if ((name = search[i])) {
                        if (~((value = name.indexOf('=')))) {
                            value = name.substring(value + 1);
                            name = decodeURIComponent(name.substring(0, name.length - value.length - 1));
                            value = decodeURIComponent(value);
                        } else {
                            value = NULL;
                        }

                        if ((cur = currentQueryParams[name])) {
                            if (!isArray(cur)) { cur = [cur]; }
                            cur.push(value);
                        } else {
                            cur = value;
                        }

                        currentQueryParams[name] = cur;
                    }
                }
            }
        },
        {}
    );


    function addRoute(uri, frame/**/, route) {
        routesFlat = []; // Depth-first flat subroutes list.
        route = new Route(uri, frame);
        routes.push(route);
        routesFlat.push(route);
        route._flat = routesFlat;
    }


    function isFunction(val) {
        return typeof val === 'function';
    }


    function isArray(val) {
        return val instanceof Array;
    }


    function isString(val) {
        return typeof val === 'string';
    }


    function isNode(val) {
        return val instanceof Node;
    }


    function checkRunning(yes) {
        if (!!running !== !!yes) {
            throwError('Running: ' + !!running);
        }
    }


    function throwError(message) {
        throw new Error(message);
    }


    function emitEvent(event, route, args/**/, handlers, cur, i) {
        if ((handlers = eventHandlers[event])) {
            args = [].concat(event, args || []);

            // Specific route handlers.
            if (((i = route._id)) && ((cur = handlers[i]))) {
                for (i = 0; i < cur.length; i++) {
                    cur[i].apply(route, args);
                }
            }

            // General route handlers.
            if ((cur = handlers[''])) {
                for (i = 0; i < cur.length; i++) {
                    cur[i].apply(route, args);
                }
            }
        }
    }


    function pushParam(part, params, allowDuplicates, pathParams/**/, type, parent) {
        parent = 1;
        if (allowDuplicates) {
            // Allow parent route params in data URIs.
            while (part.charAt(parent) === ':') {
                parent++;
            }
        }
        type = part.charAt(parent--) === '?' ? 2 : 1;
        part = part.substring(parent + type);
        if ((part in params) && !allowDuplicates) {
            throwError('Duplicate param');
        }
        params[part] = type;
        part = {param: part, optional: type === 2, parent: parent};
        if (pathParams) { pathParams.push(part); }
        return pathParams ? '(?:/([^/]+))' + (type === 2 ? '?' : '') : part;
    }


    function parseParameterizedURI(uri, isDataURI, keepLastSlash) {
        var pathname,
            search,
            hash,
            i,
            name,
            value,
            params = {},
            pathExpr = [],
            pathParams = [],
            queryParams;

        (uri || '').replace(/^((?:(?:\:\?)|[^?#])*)(?:\?([^#]*))?(?:#(.*))?$/, function(_, p, s, h) {
            pathname = (p || '').split('/');
            search = (s || '').split('&');
            hash = h;
        });

        value = pathname.length;
        for (i = 0; i < value; i++) {
            if ((name = decodeURIComponent(pathname[i])) || (keepLastSlash && (i === value - 1))) {
                pathExpr.push(
                        name.charAt(0) === ':' ?
                        pushParam(name, params, isDataURI, isDataURI ? undefined : pathParams)
                        :
                        (isDataURI ? name : '/' + name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
                );
            }
        }

        for (i = 0; i < search.length; i++) {
            if ((name = search[i])) {
                if (!queryParams) { queryParams = {}; }

                if (~((value = name.indexOf('=')))) {
                    value = name.substring(value + 1);
                    name = decodeURIComponent(name.substring(0, name.length - value.length - 1));
                    value = decodeURIComponent(value);
                } else {
                    value = NULL;
                }

                if (name.charAt(0) === ':') { throwError('Invalid queryparam'); }
                if (name in queryParams) { throwError('Duplicate queryparam'); }

                queryParams[name] = value && value.charAt(0) === ':' ?
                    pushParam(value, params, isDataURI)
                    :
                    {value: value};
            }
        }

        if (hash) {
            hash = hash.charAt(0) === ':' ? pushParam(hash, params, isDataURI) : {value: hash};
        }

        return {
            pathname: [pathExpr, pathParams],
            search: queryParams,
            hash: hash,
            params: params
        };
    }


    function checkAndSetParam(name, value, expected, constraints, queryparams, params/**/, constraint, ok) {
        if (expected.param && constraints) {
            constraint = constraints[expected.param];
        }

        switch (true) {
            case 'value' in expected ? expected.value === value : (value !== undefined && !constraint):
                ok = true;
                break;

            case isFunction(constraint):
                ok = (((value = constraint(value))) !== undefined) || expected.optional;
                break;

            case (value === undefined) && expected.optional:
                ok = true;
                break;

            case (constraint instanceof RegExp) && (value !== undefined):
                ok = constraint.test(value);
                break;

            case isArray(constraint):
                ok = constraint.indexOf(value) >= 0;
                break;

            case isString(constraint):
                ok = constraint === value;
                break;

            default:
                ok = false;
        }

        if (ok && value !== undefined) {
            if (name !== undefined) { queryparams[name] = value; }
            if (expected && expected.param) { params[expected.param] = value; }
        }

        return ok;
    }


    function deactivateRoute(route/**/, a) {
        if ((a = route._a)) {
            while (route) {
                // Tell parents about it.
                route._a -= a;
                route = route.parent;
            }
        }
    }


    function Route(uri, frame, pathExpr, paramsOffset, parent, form) {
        var self = this,
            i,
            frames,
            f,
            route = /.*/, // Default value is for NotFound route.
            childRoute,
            pathnameExpr,
            pathParams,
            uriSearch,
            uriHash,
            paramsConstraints,
            currentParams = {};

        self.parent = parent;
        self.children = [];
        self.uri = uri;
        self._id = 'r' + (++routeId);
        self._n = {};

        if (frame) {
            paramsConstraints = frame.params;
            if ((i = self.id = frame.id)) {
                if (i in routeById) { throwError('Duplicate id: ' + i); }
                routeById[i] = self;
            }
            self.title = frame.title || (parent && parent.title);
            self.renderParent = frame.parent || (parent && parent.renderParent);
            self.render = f = normalizeRender(frame.render);

            if (form) {
                self.isForm = true;
                self.action = frame.action;
                self._method = frame.method;
                self.check = frame.check;
                self.state = frame.state;
                self.type = frame.type;
                self[STR_SUBMIT] = frame[STR_SUBMIT];
            } else {
                self.keep = frame.keep;
                self[dataSourceKey] = frame.data;
            }

            if (frame.form) {
                self.form = new Route(undefined, frame.form, undefined, undefined, self, true);
            }
        }

        if (uri !== undefined) {
            uri = parseParameterizedURI(uri);
            pathExpr = [].concat(pathExpr || [], uri.pathname[0]);

            pathnameExpr = new RegExp(pathExpr.join('') + '(?:/(.*))?');
            pathParams = uri.pathname[1];
            uriSearch = uri.search;
            uriHash = uri.hash;

            if (!paramsOffset) { paramsOffset = 1; }

            route = function(pathname) {
                currentParams = {};

                var match = pathname.match(pathnameExpr),
                    i;

                if (match) {
                    for (i = pathParams.length; i--;) {
                        if (!checkAndSetParam(
                                undefined,
                                match[paramsOffset + i],
                                pathParams[i],
                                paramsConstraints,
                                undefined,
                                currentParams)
                            )
                        {
                            deactivateRoute(self);
                            return false;
                        }
                    }

                    // self._d means that there are no further pathname components.
                    // self._a means active route.
                    if ((self._d = !match[paramsOffset + pathParams.length])) {
                        // Deepest matched frame and there is render for this route.
                        self._a = 1;
                        i = parent;
                        while (i) {
                            // Tell parents about it.
                            i._a++;
                            i = i.parent;
                        }
                    }
                }

                return self._a ? currentParams : false;
            };


            if (uriSearch || uriHash) {
                route = {pathname: route};

                if (uriSearch) {
                    route.search = function() {
                        var queryparams = {},
                            queryparam;

                        for (queryparam in uriSearch) {
                            if (!checkAndSetParam(
                                    queryparam,
                                    currentQueryParams[queryparam],
                                    uriSearch[queryparam],
                                    paramsConstraints,
                                    queryparams,
                                    currentParams)
                                )
                            {
                                deactivateRoute(self);
                                return false;
                            }
                        }

                        return queryparams;
                    };
                }

                if (uriHash) {
                    route.hash = function(hash) {
                        var i = checkAndSetParam(
                                undefined,
                                hash || undefined,
                                uriHash,
                                paramsConstraints,
                                undefined,
                                currentParams
                            )
                            ?
                            hash || true
                            :
                            false;

                        if (!i) {
                            deactivateRoute(self);
                        }

                        return i;
                    };
                }
            }

            if ((frames = frame && frame.frames)) {
                for (f in frames) {
                    childRoute = new Route(
                        f,
                        frames[f],
                        pathExpr,
                        paramsOffset + pathParams.length,
                        self
                    );

                    routesFlat.push(childRoute);
                    self.children.push(childRoute);
                }
            }
        }

        $H.on(route, {
            go: function(same) {
                if (!uri) {
                    // It's not found target, no URI matching functions have
                    // been called, set active flag here.
                    self._a = 1;
                }
                self._p = currentParams;
                self._s = same;
            },
            leave: function() {
                self._p = NULL;
            }
        });
    }


    function normalizeRender(render) {
        render = isString(render) ||
                 isFunction(render) ||
                 isArray(render) ||
                 render === NULL ||
                 (render && render.template)
            ?
            {success: render}
            :
            render || {};

        var ret = {},
            i,
            key,
            val;

        for (i = RENDER_KEYS.length; i--;) {
            if (!isArray((val = render[(key = RENDER_KEYS[i])])) && val !== undefined) {
                val = [val];
            }
            if (val) {
                ret[key] = val;
            }
        }

        return ret;
    }


    function getURIParam(route, param, overrideParams/**/, i, name) {
        name = param.param;

        if (overrideParams && (name in overrideParams)) {
            i = overrideParams[name];
        } else {
            i = param.parent;

            while (route && i) {
                route = route.parent;
                i--;
            }

            i = ((i = route && route._p)) ? i[name] : undefined;
        }

        return i;
    }


    function makeURI(route, uri, overrideParams, pathname, queryparams, processedQueryparams, hash, child) {
        // TODO: Test params and throw errors when necessary.
        var i,
            j,
            pathObj,
            part,
            val;

        if (!processedQueryparams) {
            pathname = [];
            queryparams = [];
            processedQueryparams = {};
        }

        uri = parseParameterizedURI(uri, true, !overrideParams);

        pathObj = uri.pathname[0];

        for (i = pathObj.length; i--;) {
            part = pathObj[i];
            val = part.param ? getURIParam(route, part, overrideParams) : part;

            if (val !== undefined) {
                pathname.unshift(encodeURIComponent(val));
            }
        }

        if ((pathObj = uri.search)) {
            for (i in pathObj) {
                if (!(i in processedQueryparams)) {
                    processedQueryparams[i] = true;

                    part = pathObj[i];
                    i = encodeURIComponent(i);

                    if (part.param) {
                        val = getURIParam(route, part, overrideParams);
                        if (isArray(val)) {
                            for (j = 0; j < val.length; j++) {
                                queryparams.push(i + '=' + encodeURIComponent(val[j]));
                            }
                            continue;
                        }
                    } else {
                        val = part.value;
                    }

                    if (val !== undefined) {
                        queryparams.push(i + '=' + encodeURIComponent(val));
                    }
                }
            }
        }

        if (!hash && ((pathObj = uri.hash))) {
            hash = pathObj.param ? getURIParam(route, pathObj, overrideParams) : pathObj.value;
        }

        if (overrideParams && ((i = route.parent))) {
            // Building route URI from routes tree, current state and params to override.
            makeURI(i, i.uri, overrideParams, pathname, queryparams, processedQueryparams, hash, true);
        }

        if (!child) {
            // Skip this part for recursive call.
            pathname = ('/' + pathname.join('/')).replace(/\/+/g, '/');

            if (queryparams.length) {
                pathname += '?' + queryparams.join('&');
            }

            if (hash) {
                pathname += '#' + encodeURIComponent(hash);
            }

            return pathname;
        }
    }


    function AJAX(uri, route, body/**/, val, self) {
        self = this;

        self.ok = [];
        self.error = [];

        self._r = val = new XMLHttpRequest();

        if (val) {
            val.open(route.method || 'GET', makeURI(route, uri), true);
            val.onreadystatechange = function() {
                if (val.readyState === 4) { // Completed.
                    self._done = self._error = true;
                    self._r = undefined;
                    if (val.status === 200) {
                        try {
                            self._data = JSON.parse(val.responseText);
                            self._error = false;
                        } catch(e) {}
                    }
                    self.done();
                }
            };

            if (body) {
                body = body(val);
            }

            val.send(body);
        } else {
            self._done = self._error = true;
            self.done();
        }
    }


    proto = AJAX.prototype;


    proto.then = function(ok, error) {
        var self = this;
        if (ok) { self.ok.push(ok); }
        if (error) { self.error.push(error); }
        self.done();
    };


    proto.reject = function() {
        var self = this;

        if (!self._done) {
            if (self._r) {
                self._r.abort();
                self._r = undefined;
            }
            self._done = self._error = true;
            self.done();
        }
    };


    proto.done = function() {
        var self = this,
            todo,
            data;

        if (self._done) {
            if (self._error) {
                todo = self.error;
            } else {
                todo = self.ok;
                data = self._data;
            }

            while (todo.length) {
                todo.shift()(data);
            }
        }
    };


    function getRenderParent(route, parent1, parent2/**/, id) {
        parent1 = parent1 || parent2 || defaultParent;

        if (parent1 && !isNode(parent1)) {
            if (isFunction(parent1)) {
                parent1 = parent1.call(route);
            } else {
                parent1 = document.querySelector(parent1);
            }
        }

        if ((parent1 = isNode(parent1) ? parent1 : NULL)) {
            if (!((id = parent1._$Cid))) {
                parent1._$Cid = id = ++routeId;
            }
            // Add placeholder for this route in this parent node.
            if (!(route._n[id])) {
                route._n[id] = [(parent2 = document.createComment(''))];
                parent1.appendChild(parent2);
            }
        }

        return parent1;
    }


    function processRender(stage, render, datas, defaultRenderParent, route, formNode, noRemove, target) {
        var i,
            mem,
            params,
            node,
            parent,
            renderParent,
            placeholder,
            args;

        if (target === undefined) {
            target = render[stage] || defaultRender[stage];
        }

        if (isArray(target)) {
            try {
                for (i = 0; i < target.length; i++) {
                    if (processRender(stage, render, datas, defaultRenderParent, route, formNode, i !== 0, target[i]) === false) {
                        break;
                    }
                }
            } catch(e) {
                processRender(STR_EXCEPT, render, [e, stage, i, target[i]], defaultRenderParent, route, formNode);
            }
        } else if (target || target === NULL) {
            // null-value target could be used to remove previous render nodes.
            renderParent = getRenderParent(route, target && target.parent, defaultRenderParent);
            if (renderParent) {
                mem = route._n[renderParent._$Cid];
                placeholder = mem[0];
                params = route._p;

                if (target) {
                    args = [].concat(datas, params, route);
                    if (formNode) { args.push(formNode); }
                    if (isFunction(target)) {
                        node = target.apply(route, args);
                        if (node === false) { return node; }
                        if (node === NULL) { target = NULL; }
                        if (isString(node)) { i = node; }
                    } else {
                        i = isString(target) ? target : target.template;
                    }

                    if (isString(i)) {
                        node = $C.tpl[i].apply(NULL, args);
                    }
                }

                if (!target || isNode(node)) {
                    // Remove nodes from previous routes if any.
                    removeNodes(oldDOM, 0);

                    if (!noRemove) {
                        noRemove = target && (target.replace === false);
                    }

                    if (!noRemove) {
                        // By default we are replacing everything from previous
                        // render of this route in this parent.
                        removeNodes(mem, 1);
                    }

                    if (target) {
                        if (node.nodeType === 11) {
                            i = node.firstChild;
                            while (i) {
                                mem.push(i);
                                i[routeNodeKey] = route;
                                i = i.nextSibling;
                            }
                        } else {
                            if ((parent = node.parentNode)) {
                                parent.removeChild(node);
                            }
                            mem.push(node);
                            node[routeNodeKey] = route;
                        }
                    }
                }

                if (isNode(node) && ((parent = placeholder.parentNode))) {
                    parent.insertBefore(node, placeholder);
                }
            }
        }
    }


    function ProcessRoute(route, formNode, formBody) {
        if (route._data instanceof ProcessRoute) { return; }

        var skip = (route._data !== undefined) && !route._dataError,
            self = this,
            datas = self.datas = [],
            dataSource = route[dataSourceKey],
            i,
            d,
            waiting = 0,
            render = route.render,
            defaultRenderParent,
            resolve,
            done = function(index, data, /**/i, children, r, error) {
                if (index !== undefined) {
                    datas[index] = data;
                    waiting--;
                }

                if (!waiting && !self.rejected) {
                    error = route._dataError;
                    children = route.children;

                    if (!skip) {
                        route._data = datas;

                        if (route.isForm) {
                            setFormState(route.parent, route, FORM_STATE_VALID);
                        }

                        if (error) {
                            processRender(STR_ERROR, render, [], defaultRenderParent, route, formNode);
                            emitEvent(STR_ERROR, route);
                        } else {
                            processRender(STR_SUCCESS, render, datas, defaultRenderParent, route, formNode);
                            emitEvent(STR_SUCCESS, route);
                        }

                        processRender(STR_AFTER, render, error ? [true] : [], defaultRenderParent, route, formNode);
                        emitEvent(STR_AFTER, route);
                    }

                    if (!error) {
                        for (i = 0; i < children.length; i++) {
                            r = children[i];
                            if (r._id in currentRoutes) {
                                new ProcessRoute(r);
                            }
                        }
                    }
                }
            };

        if (!skip) {
            route._data = self;

            defaultRenderParent = getRenderParent(route, route.renderParent);

            document.title = (i = (isFunction((i = route.title)) ? i() : i)) === undefined
                ?
                defaultTitle
                :
                i;

            processRender(STR_BEFORE, render, [], defaultRenderParent, route, formNode);
            emitEvent(STR_BEFORE, route);

            if (dataSource !== undefined) {
                if (!isArray(dataSource)) {
                    dataSource = [dataSource];
                }

                resolve = function(index) {
                    waiting++;
                    d.then(function (ok) {
                        done(index, ok);
                    }, function () {
                        route._dataError = true;
                        done(index);
                    });
                };

                for (i = 0; i < dataSource.length; i++) {
                    d = dataSource[i];

                    if (isString(d)) {
                        d = new AJAX(d, route, formBody);
                    }

                    if (isFunction(d)) {
                        d = d.call(route);
                    }

                    datas.push(d);

                    if (d && isFunction(d.then)) {
                        resolve(i);
                    }

                }
            }
        }

        done();
    }


    ProcessRoute.prototype.reject = function() {
        var datas = this.datas,
            i,
            d;

        this.rejected = true;

        for (i = datas.length; i--;) {
            d = datas[i];
            if (isFunction(d.abort)) { d.abort(); }
            if (isFunction(d.reject)) { d.reject(); }
        }
    };


    function unprocessRoute(route, keepPlaceholders) {
        var children,
            i;

        children = route.children;
        for (i = children.length; i--;) {
            unprocessRoute(children[i]);
        }

        // Stop processing route and remove associated nodes.
        if (route._data && isFunction(route._data.reject)) {
            route._data.reject();
            emitEvent('stop', route);
        }

        if (route._data !== undefined) {
            route._data = route._dataError = undefined;
            emitEvent('leave', route);
            rememberOldDOM(route, keepPlaceholders);
        }
    }


    function rememberOldDOM(route, keepPlaceholders) {
        var nodesets,
            i,
            nodes;

        nodesets = route._n;
        keepPlaceholders = keepPlaceholders ? 1 : 0;

        for (i in nodesets) {
            nodes = nodesets[i];
            while (nodes.length > keepPlaceholders) {
                oldDOM.push(nodes.pop());
            }
        }

        if (!keepPlaceholders) {
            route._n = {};
        }
    }


    function removeNodes(nodes, stop/**/, parent, node) {
        while (nodes.length > stop) {
            node = nodes.pop();
            if ((parent = node.parentNode)) {
                parent.removeChild(node);
            }
        }
    }


    function serializeForm(node) {
        var i,
            j,
            elems,
            elem,
            name,
            opts,
            val,
            serialized = [],
            fields = [];

        if (node instanceof HTMLFormElement) {
            elems = node.elements;

            for (i = 0; i < elems.length; i++) {
                elem = elems[i];
                val = undefined;

                if ((name = elem.name)) {
                    switch (elem.type) {
                        case STR_SUBMIT:
                        case 'reset':
                        case 'button':
                        case 'file':
                            break;

                        case 'checkbox':
                        case 'radio':
                            if (elem.checked) {
                                val = elem.value || '';
                            }
                            break;

                        case 'select-multiple':
                            opts = elem.options;
                            val = [];
                            for (j = 0; j < opts.length; j++) {
                                if (opts[j].selected) {
                                    val.push(opts[j].value);
                                }
                            }
                            break;

                        default:
                            val = elem.value || '';
                    }
                }

                fields.push([elem, val]);

                if (!elem.disabled && val !== undefined) {
                    if (!isArray(val)) { val = [val]; }
                    for (j = 0; j < val.length; j++) {
                        serialized.push({name: name, value: val[j]});
                    }
                }
            }
        }

        return [serialized, fields];
    }


    return API;
})(document, decodeURIComponent, encodeURIComponent);
