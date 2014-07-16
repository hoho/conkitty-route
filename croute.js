$C.route = (function() {
    'use strict';

    function Route(parent) {

    }

    function pushParam(part, params, pathParams/**/, type) {
        type = part.charAt(1) === '?' ? 2 : 1;
        part = part.substring(type);
        if (part in params) {
            throw new Error('Duplicate param');
        }
        params[part] = type;
        pathParams && pathParams.push(part);
        return pathParams ? '(?:/([^/]+))' + (type === 2 ? '?' : '') : {param: part};
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
            queryParams = {},
            error;

        (uri || '').replace(/^((?:(?:\:\?)|[^?#])*)(?:\?([^#]*))?(?:#(.*))?$/, function(_, p, s, h) {
            pathname = (p || '').split('/');
            search = (s || '').split('&');
            hash = h || '';
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
                if (((value = name.indexOf('='))) >= 0) {
                    value = name.substring(value + 1);
                    name = name.substring(0, name.length - value.length - 1);
                } else {
                    value = '';
                }

                error = '';
                if (name.charAt(0) === ':') { error = 'Invalid queryparam name'; }
                if (name in queryParams) { error = 'Duplicate queryparam'; }
                if (error) { throw new Error(error); }

                if (value.charAt(0) === ':') {
                    value = pushParam(value, params);
                } else {
                    value = {value: value};
                }
                queryParams[name] = value;
            }
        }

        if (hash.charAt(0) === ':') {
            hash = pushParam(hash, params);
        } else {
            hash = {value: hash};
        }

        return {
            pathname: [pathExpr, pathParams],
            search: queryParams,
            hash: hash,
            params: params
        };
    }

    function buildRoute(uri, action) {
        console.log(parseParameterizedURI(uri));
    }

    var defaultTitle,

        routes = [],

        RoutePrototype = Route.prototype,

        API = {
            add: function(uri, action) {
                routes.concat(buildRoute(uri, action));
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

            set: function(uri, depth) {

            },

            run: function(title) {
                defaultTitle = title;
            },

            on: function(event, handler) {

            },

            off: function(event, handler) {

            }
        };

    RoutePrototype.match = function(uri) {

    };

    RoutePrototype.on = function(event, handler) {

    };

    RoutePrototype.off = function(event, handler) {

    };

    return API;
})();
