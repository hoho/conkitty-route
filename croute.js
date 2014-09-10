/*!
 * conkitty-route v0.1.4, https://github.com/hoho/conkitty-route
 * (c) 2014 Marat Abdullin, MIT license
 */

/* global $C */
/* global $H */
$C.route = (function(document, decodeURIComponent, encodeURIComponent, location, undefined) {
    'use strict';

    var defaultTitle,
        defaultRender,
        defaultParent,

        running,

        currentQueryParams,
        currentRoutes = {},

        reloadCurrent,

        routes = [],
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
        KEY_ROUTE = '_$Croute',
        KEY_DATASOURCE = 'dataSource',
        KEY_DATAERROR = '_dataError',

        FORM_STATE_VALID = 'valid',
        FORM_STATE_INVALID = 'invalid',
        FORM_STATE_SENDING = 'sending',

        STR_BEFORE = 'before',
        STR_SUCCESS = 'success',
        STR_ERROR = 'error',
        STR_AFTER = 'after',
        STR_EXCEPT = 'except',

        STR_SUBMIT = 'submit',

        KEY_PARENT = 'parent',
        KEY_RENDER_PARENT = 'renderParent',

        NULL = null,

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


    API.set = function set(uri, reload, replace) {
        checkRunning(true);
        reloadCurrent = reload;
        return $H.go(uri, undefined, replace);
    };


    API.run = function run(defaults) {
        checkRunning();

        var body = document.body,
            addEvent = body.addEventListener.bind(body);

        defaults = defaults || {};

        defaultTitle = defaults.title || '';
        defaultRender = normalizeRender(defaults.render);
        defaultParent = defaults[KEY_PARENT] || body;

        if (notFoundRoute) {
            addRoute(undefined, notFoundRoute);
        }

        $H.on(undefined, function() {
            var newRootRoute,
                newRoutes = {},
                i,
                route,
                traverseCallback = function(r/**/, final) {
                    if (r._a) {
                        newRoutes[r._id] = r;
                        if (isFunction((final = r.final))) {
                            final = final.call(r);
                        }
                        return !!final;
                    }
                };

            for (i = 0; i < routes.length; i++) {
                route = routes[i];
                if (route._a) {
                    traverseRoute((newRootRoute = route), traverseCallback);
                    break;
                }
            }

            for (i in currentRoutes) {
                route = currentRoutes[i];
                if (!(i in newRoutes) ||
                    reloadCurrent ||
                    !route._s ||
                    route.keep === false ||
                    route[KEY_DATAERROR])
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

        addEvent('click', function(e) {
            var elem = e.target;
            while (elem && !(elem instanceof HTMLAnchorElement)) {
                elem = elem.parentNode;
            }
            if (elem &&
                !elem.target &&
                (elem.host === location.host) &&
                !(e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.which !== 1)))
            {
                e.preventDefault();
                API.set(elem.href);
            }
        }, false);

        addEvent(STR_SUBMIT, function(e) {
            var target = e.target,
                formNode = target,
                route,
                form,
                data,
                action;

            while (target && !((route = target[KEY_ROUTE]))) {
                target = target.parentNode;
            }

            if (route && ((form = route.form))) {
                e.preventDefault();

                form = new Route(undefined, form, undefined, undefined, route, true);

                data = serializeForm(formNode, true);

                currentRoutes[form._id] = form;
                form._f = data[1];

                if (form.checkForm((data = data[0]))) {
                    form[KEY_DATASOURCE] = isFunction((action = formNode.getAttribute('action') || form.action)) ?
                        action.call(formNode, data, route)
                        :
                        action;
                    form.method = formNode.getAttribute('method') || form._method;

                    setFormState(route, form, FORM_STATE_SENDING);

                    new ProcessRoute(
                        form,
                        formNode,
                        function(xhr/**/, type, submit) {
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

                            return type === 'json' ?
                                JSON.stringify(data)
                                :
                                (data ?
                                    (type === 'text' ?
                                        data + ''
                                        :
                                        formToQuerystring(data))
                                    :
                                    undefined);
                        }
                    );
                }
            }

            if (!form && formNode.method === 'get' && !formNode.target) {
                data = document.createElement('a');
                data.href = formNode.action;
                if (data.host === location.host) {
                    e.preventDefault();
                    action = data.pathname + data.search;
                    // IE doesn't supply <a> tag pathname with leading slash.
                    API.set((action[0] === '/' ? action : ('/' + action)) + (data.search ? '&' : '?') + formToQuerystring(serializeForm(formNode)));
                }
            }
        });

        running = true;
        $H.run();
    };


    API.serializeForm = serializeForm;


    function formToQuerystring(data/**/, ret, i, param) {
        ret = [];
        for (i = 0; i < data.length; i++) {
            param = data[i];
            ret.push(encodeURIComponent(param.name) + '=' + encodeURIComponent(param.value));
        }
        return ret.join('&');
    }


    function traverseRoute(route, callback/**/, i, children) {
        children = route.children;
        for (i = 0; i < children.length; i++) {
            if (traverseRoute(children[i], callback)) {
                break;
            }
        }
        return callback(route);
    }


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
            parent = self[KEY_PARENT];
            while (parent) {
                // Check if none of parent routes is in progress.
                if (parent._data instanceof ProcessRoute) {
                    break;
                }
                parent = parent[KEY_PARENT];
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
            p = p[KEY_PARENT];
            parent--;
        }

        return p && p._p || undefined;
    };


    proto.data = function(parent) {
        var p = this,
            d;
        parent = parent || 0;
        while (p && parent > 0) {
            p = p[KEY_PARENT];
            parent--;
        }
        d = p && p._data;
        return isArray(d) ? (isArray(this[KEY_DATASOURCE]) ? d : d[0]) : undefined;
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
            route = self[KEY_PARENT],
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
            search: function(search/**/, i, j, name, value, cur) {
                // Reset active flags.
                cur = function(r) { r._a = 0; };
                for (i = routes.length; i--;) {
                    traverseRoute(routes[i], cur);
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
        route = new Route(uri, frame);
        routes.push(route);
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
                route = route[KEY_PARENT];
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

        self[KEY_PARENT] = parent;
        self.children = [];
        self.uri = uri;
        self._id = 'r' + (++routeId);
        self._n = {};

        if (frame) {
            paramsConstraints = frame.params;
            self.title = frame.title || (parent && parent.title);
            self[KEY_RENDER_PARENT] = frame[KEY_PARENT] || (parent && parent[KEY_RENDER_PARENT]);
            self.render = f = normalizeRender(frame.render);
            self.final = frame.final;

            if (form) {
                self.isForm = true;
                self.action = frame.action;
                self._method = frame.method;
                self.check = frame.check;
                self.state = frame.state;
                self.type = frame.type;
                self[STR_SUBMIT] = frame[STR_SUBMIT];
            } else {
                if ((i = self.id = frame.id)) {
                    if (i in routeById) { throwError('Duplicate id: ' + i); }
                    routeById[i] = self;
                }
                self.keep = frame.keep;
                self[KEY_DATASOURCE] = frame.data;
                self.form = frame.form;
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
                            i = i[KEY_PARENT];
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
            val,
            RENDER_KEYS = [STR_BEFORE, STR_SUCCESS, STR_ERROR, STR_AFTER, STR_EXCEPT];

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
            i = param[KEY_PARENT];

            while (route && i) {
                route = route[KEY_PARENT];
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

        if (overrideParams && ((i = route[KEY_PARENT]))) {
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


    function AJAX(uri, route, body/**/, req, self, parse, transform, response) {
        self = this;

        // self.ok — Success callbacks.
        // self.err — Error callbacks.
        // self.d — Done.
        // self.e — Error.
        // self.r = XMLHTTRequest.
        // self.j = Parsed response JSON.

        if (!isString(uri)) {
            parse = uri.parse;
            transform = uri.transform;
            uri = uri.uri;
        }

        self.ok = [];
        self.err = [];

        self.r = req = new XMLHttpRequest();

        req.open(route.method || 'GET', makeURI(route, uri), true);
        req.onreadystatechange = function() {
            if (req.readyState === 4) { // Completed.
                self.d = self.e = true;
                if (req.status === 200) {
                    try {
                        response = req.responseText;
                        route = route.isForm ? route[KEY_PARENT] : route;
                        response = parse ? parse.call(route, response, req) : JSON.parse(response);
                        self.j = transform ? transform.call(route, response, req) : response;
                        self.e = false;
                    } catch(e) {}
                }
                self.done();
                self.r = undefined;
            }
        };

        if (body) {
            body = body(req);
        }

        req.send(body);
    }


    proto = AJAX.prototype;


    proto.then = function(ok, error) {
        var self = this;
        if (ok) { self.ok.push(ok); }
        if (error) { self.err.push(error); }
        self.done();
    };


    proto.reject = function() {
        var self = this;

        if (!self.d) {
            if (self.r) {
                self.r.abort();
                self.r = undefined;
            }
            self.d = self.e = true;
            self.done();
        }
    };


    proto.done = function() {
        var self = this,
            todo,
            data;

        if (self.d) {
            if (self.e) {
                todo = self.err;
                data = self.r;
            } else {
                todo = self.ok;
                data = self.j;
            }

            while (todo.length) {
                todo.shift()(data);
            }
        }
    };


    function getRenderParent(route, parent1, parent2/**/, id, n) {
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
            n = (route.isForm ? route[KEY_PARENT] : route)._n;
            if (!(n[id])) {
                n[id] = [(parent2 = document.createComment(''))];
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
                return true;
            }
        } else if (target || target === NULL) {
            // null-value target could be used to remove previous render nodes.
            renderParent = getRenderParent(route, target && target[KEY_PARENT], defaultRenderParent);
            if (renderParent) {
                mem = (route.isForm ? route[KEY_PARENT] : route)._n[renderParent._$Cid];
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
                                i[KEY_ROUTE] = route;
                                i = i.nextSibling;
                            }
                        } else {
                            if ((parent = node.parentNode)) {
                                parent.removeChild(node);
                            }
                            mem.push(node);
                            node[KEY_ROUTE] = route;
                        }
                    }
                }

                if (isNode(node) && ((parent = placeholder.parentNode))) {
                    parent.insertBefore(node, placeholder);
                }
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
    }


    function ProcessRoute(route, formNode, formBody) {
        if (route._data instanceof ProcessRoute) { return; }

        var skip = (route._data !== undefined) && !route[KEY_DATAERROR],
            self = this,
            datas = self.datas = [],
            dataSource = route[KEY_DATASOURCE],
            i,
            d,
            waiting = 0,
            render = route.render,
            defaultRenderParent,
            resolve,
            done = function(index, data, /**/i, children, r, errors) {
                if (index !== undefined) {
                    datas[index] = data;
                    waiting--;
                }

                if (!waiting && !self.rejected) {
                    errors = route[KEY_DATAERROR];
                    children = route.children;

                    if (!skip) {
                        route._data = datas;

                        if (route.isForm) {
                            setFormState(route[KEY_PARENT], route, FORM_STATE_VALID);
                        }

                        i = errors ? STR_ERROR : STR_SUCCESS;
                        if (processRender(i, render, errors || datas, defaultRenderParent, route, formNode)) {
                            return;
                        }
                        emitEvent(i, route, errors || datas);

                        if (processRender(STR_AFTER, render, errors ? [true] : [], defaultRenderParent, route, formNode)) {
                            return;
                        }
                        emitEvent(STR_AFTER, route);
                    }

                    if (!errors) {
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

            defaultRenderParent = getRenderParent(route, route[KEY_RENDER_PARENT]);

            document.title = (i = (isFunction((i = route.title)) ? i() : i)) === undefined
                ?
                defaultTitle
                :
                i;

            if (processRender(STR_BEFORE, render, [], defaultRenderParent, route, formNode)) {
                return;
            }
            emitEvent(STR_BEFORE, route);

            if (dataSource !== undefined) {
                if (!isArray(dataSource)) {
                    dataSource = [dataSource];
                }

                resolve = function(index) {
                    waiting++;
                    d.then(function(ok) {
                        done(index, ok);
                    }, function(xhr, errors) {
                        if (!((errors = route[KEY_DATAERROR]))) {
                            errors = route[KEY_DATAERROR] = new Array(datas.length);
                        }
                        errors[index] = xhr;
                        done(index);
                    });
                };

                for (i = 0; i < dataSource.length; i++) {
                    if ((d = dataSource[i])) {
                        if (isString(d) ||
                            (isString(d.uri) && (isFunction(d.parse) || isFunction(d.transform)))) {
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
            i,
            nodesets,
            nodes;

        children = route.children;
        for (i = children.length; i--;) {
            unprocessRoute(children[i]);
        }

        // Stop processing route and remove associated nodes.
        if (route._data && isFunction(route._data.reject)) {
            route._data.reject();
            if (route.isForm) {
                unprocessRoute(route[KEY_PARENT], true);
            }
            emitEvent('stop', route);
        }

        if (route._data !== undefined) {
            route._data = route[KEY_DATAERROR] = undefined;
            emitEvent('leave', route);

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
    }


    function serializeForm(node, withFields) {
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

        return withFields ? [serialized, fields] : serialized;
    }


    return API;
})(document, decodeURIComponent, encodeURIComponent, location);
