/*!
 * conkitty-route v0.0.1, https://github.com/hoho/conkitty-route
 * (c) 2014 Marat Abdullin, MIT license
 */

/* global $C */
/* global $H */
$C.route = (function(document, decodeURIComponent, encodeURIComponent, undefined) {
    'use strict';

    var defaultTitle,

        running,

        currentQueryParams,
        currentRoutes = {},

        reloadCurrent,

        routes = [],
        routesFlat,
        routeId = 0,

        routeById = {},

        notFoundRoute,

        eventHandlers = {
            before: {},
            success: {},
            error: {},
            after: {},
            stop: {},
            leave: {},
            busy: {},
            idle: {}
        },

        busy = false,
        busyCount = 0,
        busyTimer,

        whitespace = /[\x20\t\r\n\f]+/,

        proto = Route.prototype,

        API = {
            add: function(uri, frame) {
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
            },

            set: function(uri, reload) {
                checkRunning(true);
                reloadCurrent = reload;
                return $H.go(uri);
            },

            run: function(title) {
                checkRunning();

                defaultTitle = title || '';

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
                    busyCount += e === 'before' ? 1 : -1;
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

                running = true;
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
                $H.run();
            },

            on: function(event, handler, route) {
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
            },

            off: function(event, handler, route) {
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
            },

            get: function(id) {
                return routeById[id];
            }
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
        return isArray(d) ? (isArray(this.dataSource) ? d : d[0]) : undefined;
    };


    proto.makeURI = function(params) {
        return makeURI(this, this.uri, params || {});
    };


    proto.active = function() {
        return this._id in currentRoutes;
    };


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
                        if (((value = name.indexOf('='))) >= 0) {
                            value = decodeURIComponent(name.substring(value + 1));
                            name = decodeURIComponent(name.substring(0, name.length - value.length - 1));
                        } else {
                            value = null;
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

                if (((value = name.indexOf('='))) >= 0) {
                    value = name.substring(value + 1);
                    name = name.substring(0, name.length - value.length - 1);
                } else {
                    value = null;
                }

                if (name.charAt(0) === ':') { throwError('Invalid queryparam name'); }
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


    function Route(uri, frame, pathExpr, paramsOffset, parent) {
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
            self.actionParent = frame.parent || (parent && parent.actionParent) || document.body;
            self.action = f = frame.action;
            self.dataSource = frame.data;
            self.keep = frame.keep;

            if (f && ((f = f.leave))) {
                if (!isArray(f)) { f = [f]; }
                for (i = 0; i < f.length; i++) {
                    API.on('leave', f[i], self);
                }
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
                        // Deepest matched frame and there is action for this route.
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
                self._p = null;
            }
        });
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


    function AjaxGet(uri, route/**/, val, self) {
        self = this;

        self.ok = [];
        self.error = [];

        self._r = val = new XMLHttpRequest();

        if (val) {
            val.open('GET', makeURI(route, uri), true);
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
            val.send();
        } else {
            self._done = self._error = true;
            self.done();
        }
    }


    proto = AjaxGet.prototype;


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


    function getActionParent(route, parent1, parent2/**/, id) {
        parent1 = parent1 || parent2;

        if (!isNode(parent1)) {
            if (isFunction(parent1)) {
                parent1 = parent1.call(route);
            } else {
                parent1 = document.querySelector(parent1);
            }
        }

        parent1 = isNode(parent1) ? parent1 : null;
        if (parent1) {
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


    function processAction(goal, datas, defaultActionParent, route, noRemove) {
        var i,
            mem,
            params,
            node,
            parent,
            actionParent,
            placeholder,
            args;

        if (isArray(goal)) {
            for (i = 0; i < goal.length; i++) {
                processAction(goal[i], datas, defaultActionParent, route, i !== 0);
            }
        } else if ((goal = (goal === undefined ? undefined : goal || {}))) {
            // null-value goal could be used to remove previous action nodes.
            actionParent = getActionParent(route, goal.parent, defaultActionParent);
            if (actionParent) {
                mem = route._n[actionParent._$Cid];
                placeholder = mem[0];
                params = route._p;
                i = isString(goal) ? goal : goal.template;

                if (!noRemove) {
                    noRemove = goal.replace === false;
                }

                while (mem.length > 1 && !noRemove) {
                    // By default we are replacing everything from previous
                    // action of this route in this parent.
                    node = mem.pop();
                    if ((parent = node.parentNode)) {
                        parent.removeChild(node);
                    }
                }

                args = [].concat(datas, params, route);
                node = isFunction(goal) ? goal.apply(route, args) : (i && $C.tpl[i].apply(null, args));

                if (isNode(node)) {
                    if (node.nodeType === 11) {
                        node = node.firstChild;
                    } else if ((parent = node.parentNode)) {
                        parent.removeChild(node);
                    }
                } else {
                    node = undefined;
                }

                while (node) {
                    mem.push(node);
                    i = node.nextSibling;
                    node._$Croute = route;
                    if ((parent = placeholder.parentNode)) {
                        parent.insertBefore(node, placeholder);
                    }
                    node = i;
                }
            }
        }
    }


    function ProcessRoute(route) {
        if (route._data instanceof ProcessRoute) { return; }

        var skip = (route._data !== undefined) && !route._dataError,
            self = this,
            datas = self.datas = [],
            dataSource = route.dataSource,
            i,
            d,
            waiting = 0,
            action = route.action || '',
            defaultActionParent,
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

                        if (error) {
                            processAction(action.error, [], defaultActionParent, route);
                            emitEvent('error', route);
                        } else {
                            processAction(
                                isString(action) ||
                                isFunction(action) ||
                                isArray(action) ||
                                action.template
                                ?
                                action
                                :
                                action.success,

                                datas,
                                defaultActionParent,
                                route
                            );
                            emitEvent('success', route);
                        }

                        processAction(action.after, error ? [true] : [], defaultActionParent, route);
                        emitEvent('after', route);
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

            defaultActionParent = getActionParent(route, action.parent, route.actionParent);

            document.title = (i = (isFunction((i = route.title)) ? i() : i)) === undefined
                ?
                defaultTitle
                :
                i;

            processAction(action.before, [], defaultActionParent, route);
            emitEvent('before', route);

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
                        d = new AjaxGet(d, route);
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
            i,
            nodes,
            node,
            parent;

        children = route.children;
        for (i = children.length; i--;) { unprocessRoute(children[i]); }

        // Stop processing route and remove associated nodes.
        if (route._data && isFunction(route._data.reject)) {
            route._data.reject();
            emitEvent('stop', route);
        }

        if (route._data !== undefined) {
            delete route._data;
            delete route._dataError;

            emitEvent('leave', route);

            // Remove nodes.
            children = route._n;
            keepPlaceholders = keepPlaceholders ? 1 : 0;
            for (i in children) {
                nodes = children[i];
                while (nodes.length > keepPlaceholders) {
                    node = nodes.pop();
                    if ((parent = node.parentNode)) {
                        parent.removeChild(node);
                    }
                }
            }
            if (!keepPlaceholders) {
                route._n = {};
            }
        }
    }

    return API;
})(document, decodeURIComponent, encodeURIComponent);
