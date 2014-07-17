$C.route = (function(decodeURIComponent, undefined) {
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

                        console.log(12312312321, newRoutes);
                    } else {
                        // No matches.
                        newRootRoute = undefined;
                        newRoutes = {};
                    }

                    for (i in currentRoutes) {
                        if (!(i in newRoutes) || reloadCurrent) {
                            unprocessRoute(currentRoutes[i]);
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


    function checkRunning(yes) {
        if (!!running !== !!yes) {
            throw new Error('Running: ' + !!running);
        }
    }


    function pushParam(part, params, pathParams/**/, type) {
        type = part.charAt(1) === '?' ? 2 : 1;
        part = part.substring(type);
        if (part in params) {
            throw new Error('Duplicate param');
        }
        params[part] = type;
        part = {param: part, optional: type === 2};
        pathParams && pathParams.push(part);
        return pathParams ? '(?:/([^/]+))' + (type === 2 ? '?' : '') : part;
    }

    function parseParameterizedURI(uri) {
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
            if ((name = pathname[i])) {
                pathExpr.push(
                        name.charAt(0) === ':' ?
                        pushParam(name, params, pathParams)
                        :
                        '/' + name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
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
                    pushParam(value, params)
                    :
                    {value: value};
            }
        }

        if (hash) {
            hash = hash.charAt(0) === ':' ? pushParam(hash, params) : {value: hash};
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

            case typeof constraint === 'string':
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
            go: function() {
                self._a = self.parent ? self.parent._a : true;
                self._p = currentParams;
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


    function processAction(goal, args, defaultParent, route/**/, i) {
        if (isArray(goal)) {
            for (i = 0; i < goal.length; i++) {
                processAction(goal[i], args, defaultParent, route);
            }
        } else if (goal) {
            console.log(5545545, goal, args, defaultParent, route);
        }
    }


    function ProcessRoute(route) {
        var self = this,
            datas = self.datas = [],
            dataSources = route.data,
            i,
            d,
            waiting = 0,
            action = route.action || '',
            actionParent = action.parent,
            error,
            done = function(index, data, /**/i, children, r) {
                if (index !== undefined) {
                    datas[index] = data;
                    waiting--;
                }

                if (!waiting && !self.rejected) {
                    route._data = datas;
                    children = route.children;

                    if (error) {
                        processAction(action.error, [], actionParent, route);
                    } else {
                        processAction(action.success, datas, actionParent, route);
                    }

                    processAction(action.after, error ? [true] : [], actionParent, route);

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

        route._data = self;

        processAction(action.before, [], actionParent, route);

        if (dataSources !== undefined) {
            if (!isArray(dataSources)) { dataSources = [dataSources]; }

            for (i = 0; i < dataSources.length; i++) {
                d = dataSources[i];
                if (isFunction(d)) { d = d(); }

                datas.push(d);

                (function(index) {
                    if (d && isFunction(d.then)) {
                        waiting++;
                        d.then(function(ok) {
                            done(index, ok);
                        }, function() {
                            error = true;
                            done(index);
                        });
                    }
                })(i);
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


    function unprocessRoute(route) {
        // Stop processing route and remove associated nodes.
        if (route._data && isFunction(route._data.reject)) {
            route._data.reject();
        }
        delete route._data;

        // Remove nodes.
    }


    return API;
})(decodeURIComponent);
