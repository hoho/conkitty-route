$C.route = (function(decodeURIComponent, encodeURIComponent, undefined) {
    'use strict';

    var defaultTitle,

        running,

        currentQueryParams,

        currentRoutes = {},

        reloadCurrent,

        routes = [],
        routesFlat,

        routeId = 0,

        proto = Route.prototype,

        API = {
            add: function(uri, action) {
                checkRunning();
                routesFlat = []; // Depth-first flat subroutes list.
                var route = new Route(uri, action);
                routes.push(route);
                routesFlat.push(route);
                route._flat = routesFlat;
                routesFlat = undefined;
                return API;
            },

            skip: function(route) {
                return API.add(route);
            },

            //redirect: function() {
            //
            //},

            get: function(uri) {

            },

            set: function(uri, reload) {
                checkRunning(true);
                reloadCurrent = reload;
                $H.go(uri);
            },

            run: function(title) {
                checkRunning();

                defaultTitle = title;

                $H.on(/^.*$/, {go: function() {
                    var newRootRoute,
                        newRoutes = {},
                        i,
                        route,
                        flat;

                    for (i = 0; i < routes.length; i++) {
                        route = routes[i];
                        if (route._a) { break; }
                    }

                    if (route && route._a) {
                        newRootRoute = route;
                        flat = route._flat;
                        for (i = 0; i < flat.length; i++) {
                            route = flat[i];
                            if (route._a && (route._d || route._achild)) {
                                // Active route with full path match.
                                if (route.parent) { route.parent._achild = true; }
                                newRoutes[route._id] = route;
                            }
                        }
                    } else {
                        // No matches.
                        newRootRoute = undefined;
                        newRoutes = {};
                    }

                    for (i in currentRoutes) {
                        route = currentRoutes[i];
                        if (!(i in newRoutes) || reloadCurrent || !route._s || route._dataError) {
                            unprocessRoute(route);
                        }
                    }

                    currentRoutes = newRoutes;
                    reloadCurrent = undefined;

                    if (newRootRoute) {
                        new ProcessRoute(newRootRoute);
                    }
                }});

                running = true;
                $H.run();
            },

            on: function(event, handler) {

            },

            off: function(event, handler) {

            }
        };


    proto.match = function(uri) {

    };


    proto.on = function(event, handler) {

    };


    proto.off = function(event, handler) {

    };


    // To avoid multiple parsing of query params for each route, parse them
    // once here.
    $H.on(
        {
            pathname: /^.*$/,
            search: function(search/**/, i, name, value, cur) {
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
                return true;
            }
        },
        {}
    );


    function isFunction(val) {
        return typeof val === 'function';
    }


    function isArray(val) {
        return val instanceof Array;
    }


    function isString(val) {
        return typeof val === 'string';
    }


    function checkRunning(yes) {
        if (!!running !== !!yes) {
            throw new Error('Running: ' + !!running);
        }
    }


    function pushParam(part, params, allowDuplicates, pathParams/**/, type) {
        type = part.charAt(1) === '?' ? 2 : 1;
        part = part.substring(type);
        if ((part in params) && !allowDuplicates) {
            throw new Error('Duplicate param');
        }
        params[part] = type;
        part = {param: part, optional: type === 2};
        pathParams && pathParams.push(part);
        return pathParams ? '(?:/([^/]+))' + (type === 2 ? '?' : '') : part;
    }

    function parseParameterizedURI(uri, isDataURI) {
        var pathname,
            search,
            hash,
            i,
            name,
            value,
            params = {},
            pathExpr = [],
            pathParams = [],
            queryParams,
            error;

        (uri || '').replace(/^((?:(?:\:\?)|[^?#])*)(?:\?([^#]*))?(?:#(.*))?$/, function(_, p, s, h) {
            pathname = (p || '').split('/');
            search = (s || '').split('&');
            hash = h;
        });

        for (i = 0; i < pathname.length; i++) {
            if ((name = decodeURIComponent(pathname[i]))) {
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

                error = '';
                if (name.charAt(0) === ':') { error = 'Invalid queryparam name'; }
                if (name in queryParams) { error = 'Duplicate queryparam'; }
                if (error) { throw new Error(error); }

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


    function checkAndSetParam(name, value, expected, constraints, queryparams, params/**/, constraint, newvalue, ok) {
        if (expected.param && constraints) {
            constraint = constraints[expected.param];
        }

        switch (true) {
            case value !== undefined && !constraint:
                ok = true;
                break;

            case ('value' in expected) && (expected.value === value):
                ok = true;
                break;

            case typeof constraint === 'function':
                if ((ok = (((newvalue = constraint(value))) !== undefined))) {
                    value = newvalue;
                    break;
                }

            case value === undefined && expected.optional:
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


    function Route(uri, action, pathExpr, paramsOffset, parent) {
        uri = parseParameterizedURI(uri);
        pathExpr = [].concat(pathExpr || [], uri.pathname[0]);

        var self = this,
            frames,
            f,
            route,
            pathnameExpr = new RegExp(pathExpr.join('') + '(?:/(.*))?'),
            pathParams = uri.pathname[1],
            uriSearch = uri.search,
            uriHash = uri.hash,
            paramsConstraints,
            currentParams = {};

        self.parent = parent;
        self._id = 'r' + (++routeId);

        if (action) {
            paramsConstraints = action.params;
            self.title = action.title;
            self.action = action.action;
            self.data = action.data;
        }

        if (!paramsOffset) { paramsOffset = 1; }

        route = function(pathname) {
            currentParams = {};

            var match = pathname.match(pathnameExpr),
                i;

            if (match) {
                // self._d means that there are no further pathname components.
                self._d = !match[paramsOffset + pathParams.length];

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
                        return false;
                    }
                }
            }

            return match ? currentParams : false;
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
                            return false;
                        }
                    }

                    return queryparams;
                };
            }

            if (uriHash) {
                route.hash = function(hash) {
                    return checkAndSetParam(
                            undefined,
                            hash || undefined,
                            uriHash,
                            paramsConstraints,
                            undefined,
                            currentParams
                        ) ?
                        hash || true
                        :
                        false;
                };
            }
        }

        $H.on(route, {
            go: function(same) {
                self._a = self.parent ? self.parent._a : true;
                self._p = currentParams;
                self._s = same;
            },
            leave: function() {
                self._a = self._achild = self._p = null;
            }
        });

        self.children = [];

        if ((frames = action && action.frames)) {
            for (f in frames) {
                route = new Route(
                    f,
                    frames[f],
                    pathExpr,
                    paramsOffset + pathParams.length,
                    self
                );

                routesFlat.push(route);
                self.children.push(route);
            }
        }
    }


    function AjaxGet(uri, params) {
        // TODO: Test params and throw errors when necessary.
        var ajaxPathname,
            ajaxQueryparams,
            i,
            j,
            pathObj,
            part,
            val,
            self = this;

        uri = parseParameterizedURI(uri, true);

        ajaxPathname = [];
        ajaxQueryparams = [];

        pathObj = uri.pathname[0];

        for (i = 0; i < pathObj.length; i++) {
            part = pathObj[i];
            if (part.param) {
                part = params[part.param];
                if (part !== undefined) { part = encodeURIComponent(part); }
            } else {
                part = encodeURIComponent(part);
            }

            if (part !== undefined) {
                ajaxPathname.push(part);
            }
        }

        if ((pathObj = uri.search)) {
            for (i in pathObj) {
                part = pathObj[i];
                i = encodeURIComponent(i);
                if (part.param) {
                    val = params[part.param];
                    if (isArray(val)) {
                        for (j = 0; j < val.length; j++) {
                            ajaxQueryparams.push(i + '=' + encodeURIComponent(val[j]));
                        }
                        continue;
                    }
                } else {
                    val = part.value;
                }

                if (val !== undefined) {
                    ajaxQueryparams.push(i + '=' + encodeURIComponent(val));
                }
            }
        }

        ajaxPathname = '/' + ajaxPathname.join('/');
        if (ajaxQueryparams.length) {
            ajaxPathname += '?' + ajaxQueryparams.join('&');
        }

        self.ok = [];
        self.error = [];

        self._r = val = new XMLHttpRequest();

        if (val) {
            val.open('GET', ajaxPathname, true);
            val.onreadystatechange = function() {
                if (val.readyState === 4 /* complete */) {
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
        ok && self.ok.push(ok);
        error && self.error.push(error);
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


    function processAction(goal, datas, defaultParent, route/**/, i, params) {
        if (isArray(goal)) {
            for (i = 0; i < goal.length; i++) {
                processAction(goal[i], datas, defaultParent, route);
            }
        } else if (goal) {
            params = route._p;
            console.log(5545545, goal, params, datas, defaultParent, route);
        }
    }


    function ProcessRoute(route) {
        if (route._data instanceof ProcessRoute) { return; }

        var skip = (route._data !== undefined) && !route._dataError,
            self = this,
            datas = self.datas = [],
            dataSources = route.data,
            i,
            d,
            waiting = 0,
            action = route.action || '',
            actionParent = action.parent,
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
                            processAction(action.error, [], actionParent, route);
                        } else {
                            processAction(isString(action) || action.template ? action : action.success, datas, actionParent, route);
                        }

                        processAction(action.after, error ? [true] : [], actionParent, route);
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

            processAction(action.before, [], actionParent, route);

            if (dataSources !== undefined) {
                if (!isArray(dataSources)) {
                    dataSources = [dataSources];
                }

                for (i = 0; i < dataSources.length; i++) {
                    d = dataSources[i];

                    if (isString(d)) {
                        d = new AjaxGet(d, route._p);
                    }

                    if (isFunction(d)) {
                        d = d();
                    }

                    datas.push(d);

                    if (d && isFunction(d.then)) {
                        (function (index) {
                            waiting++;
                            d.then(function (ok) {
                                done(index, ok);
                            }, function () {
                                delete route._data;
                                route._dataError = true;
                                done(index);
                            });
                        })(i);
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


    function unprocessRoute(route/**/, children, r) {
        children = route.children;
        for (r in children) { unprocessRoute(children[r]); }

        // Stop processing route and remove associated nodes.
        if (route._data && isFunction(route._data.reject)) {
            route._data.reject();
        }
        delete route._data;
        delete route._dataError;

        // Remove nodes.
    }


    return API;
})(decodeURIComponent, encodeURIComponent);
