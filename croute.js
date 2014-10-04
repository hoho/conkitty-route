/*!
 * conkitty-route v0.2.1, https://github.com/hoho/conkitty-route
 * (c) 2014 Marat Abdullin, MIT license
 */

/* global $H */
window.$CR = (function(document, decodeURIComponent, encodeURIComponent, location, undefined) {
    'use strict';

    var defaultTitle,
        defaultRender,
        defaultParent,

        callTemplateFunc,

        running,

        currentQueryParams,
        currentFrames = {},

        reloadCurrent,

        frames = [],
        frameId = 0,

        frameById = {},

        notFoundFrame,

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
        KEY_FRAME = '_$Cf',
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

        CANCELLED = {d: NULL},

        proto = Frame.prototype,

        API = function add(uri, frameSettings) {
            checkRunning();
            if (isString(uri) && isString(frameSettings)) {
                // It's a rewrite.
                $H.on(uri, frameSettings);
            } else {
                if (uri) {
                    addFrame(uri, frameSettings);
                } else if (!notFoundFrame) {
                    // NotFound frame needs to be last, we'll add it in
                    // run() method.
                    notFoundFrame = frameSettings;
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
        callTemplateFunc = defaults.callTemplate || function(name, args/**/, tpl) {
            /* global $C */
            if (!((tpl = $C.tpl[name]))) { throwError('No `' + name + '` template'); }
            return tpl.apply(NULL, args);
        };

        if (notFoundFrame) {
            addFrame(undefined, notFoundFrame);
        }

        $H.on(undefined, function() {
            var newRootFrame,
                newFrames = {},
                i,
                frame,
                haveNewFrames,
                newFramesCount = 0,
                currentFramesCount = 0,
                traverseCallback = function(r/**/, id, final) {
                    if (r._a) {
                        newFrames[(id = r._id)] = r;
                        newFramesCount++;
                        if (!haveNewFrames && !(id in currentFrames)) {
                            haveNewFrames = true;
                        }
                        if (isFunction((final = r.final))) {
                            final = final.call(r);
                        }
                        return !!final;
                    }
                };

            for (i = 0; i < frames.length; i++) {
                frame = frames[i];
                if (frame._a) {
                    traverseFrame((newRootFrame = frame), traverseCallback);
                    break;
                }
            }

            for (i in currentFrames) {
                currentFramesCount++;
                frame = currentFrames[i];
                i = i in newFrames;
                if (!i ||
                    reloadCurrent ||
                    !frame._s ||
                    frame.keep === false ||
                    frame[KEY_DATAERROR])
                {
                    unprocessFrame(frame, newFrames);
                }
                if (i) {
                    // A flag for frame.active(true) to show that this frame
                    // is not just active, but was active in previous location
                    // too.
                    frame._s = 1;
                }
            }

            if (!haveNewFrames && (newFramesCount < currentFramesCount)) {
                removeNodes(oldDOM, 0);
            }

            currentFrames = newFrames;
            reloadCurrent = undefined;

            if (newRootFrame) {
                new ProcessFrame(newRootFrame);
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
                frame,
                form,
                data,
                action;

            while (target && !((frame = target[KEY_FRAME]))) {
                target = target.parentNode;
            }

            if (frame && ((form = frame.form))) {
                e.preventDefault();

                form = new Frame(undefined, form, undefined, undefined, frame, true);

                data = serializeForm(formNode, true);

                currentFrames[form._id] = form;
                form._f = data[1];

                if (form.checkForm((data = data[0]))) {
                    form[KEY_DATASOURCE] = isFunction((action = formNode.getAttribute('action') || form.action)) ?
                        action.call(formNode, data, frame)
                        :
                        (action || location.href);
                    form.method = formNode.getAttribute('method') || form._method || 'get';

                    new ProcessFrame(
                        form,
                        formNode,
                        function(xhr/**/, type, submit, cancelled) {
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

                            formNode.cancel = function() { form._c = cancelled = CANCELLED; };
                            data = (submit = form[STR_SUBMIT]) ?
                                submit.call(formNode, data, xhr, frame)
                                :
                                data;
                            delete formNode.cancel;

                            if (!cancelled) {
                                setFormState(frame, form, FORM_STATE_SENDING);
                            }

                            return cancelled ||
                                (type === 'json' ?
                                    JSON.stringify(data)
                                    :
                                    (data ?
                                        (type === 'text' ?
                                            data + ''
                                            :
                                            formToQuerystring(data))
                                        :
                                        undefined));
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


    API.makeURI = function(uri, params) {
        return makeURI(undefined, uri, params);
    };


    function formToQuerystring(data/**/, ret, i, param) {
        ret = [];
        for (i = 0; i < data.length; i++) {
            param = data[i];
            ret.push(encodeURIComponent(param.name) + '=' + encodeURIComponent(param.value));
        }
        return ret.join('&');
    }


    function traverseFrame(frame, callback/**/, i, children) {
        children = frame.children;
        for (i = 0; i < children.length; i++) {
            if (traverseFrame(children[i], callback)) {
                break;
            }
        }
        return callback(frame);
    }


    API.on = function on(event, handler, frame) {
        var i = '',
            handlers,
            currentHandlers;

        if (isString(event) && isFunction(handler)) {
            event = event.split(whitespace);
            if (event.length === 1) {
                if ((handlers = eventHandlers[event])) {
                    if (frame) {
                        if ((i = frameById[frame])) { frame = i; }
                        i = frame._id;
                    }
                    if (!((currentHandlers = handlers[i]))) {
                        currentHandlers = handlers[i] = [];
                    }
                    currentHandlers.push(handler);
                }
            } else {
                for (i = event.length; i--;) {
                    API.on(event[i], handler, frame);
                }
            }
        }
        return API;
    };


    API.off = function off(event, handler, frame) {
        var i = '',
            currentHandlers;

        if (isString(event) && isFunction(handler)) {
            event = event.split(whitespace);
            if (event.length === 1) {
                if (frame) {
                    if ((i = frameById[frame])) { frame = i; }
                    i = frame._id;
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
                    API.on(event[i], handler, frame);
                }
            }
        }
        return API;
    };


    API.get = function get(id) {
        return frameById[id];
    };


    API.params = function params() {
        return currentQueryParams;
    };


    proto.reload = function() {
        var self = this,
            parent;

        if (self._id in currentFrames) {
            parent = self[KEY_PARENT];
            while (parent) {
                // Check if none of parent frames is in progress.
                if (parent._data instanceof ProcessFrame) {
                    break;
                }
                parent = parent[KEY_PARENT];
            }
            if (!parent) {
                unprocessFrame(self, currentFrames, true);
                new ProcessFrame(self);
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


    proto.active = function(andPrev) {
        return (this._id in currentFrames) && (andPrev ? this._s === 1 : true);
    };


    proto.checkForm = function(data) {
        var self = this,
            fields = self._f || [],
            i,
            frame = self[KEY_PARENT],
            check = self.check,
            field,
            error,
            hasError;

        for (i = 0; i < fields.length; i++) {
            field = fields[i];
            error = check ? check.call(frame, field[0], field[1], data) : undefined;
            setFieldState(
                frame,
                self,
                field,
                error ? ((hasError = true), FORM_STATE_INVALID) : FORM_STATE_VALID,
                error
            );
        }

        return !hasError;
    };


    function setFieldState(frame, form, field, stateValue, msg) {
        var state = form.state,
            input = field[0],
            s = state ? state.call(frame, input, stateValue, msg) : undefined,
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


    function setFormState(frame, form, state) {
        var fields = form._f,
            i;

        for (i = 0; i < fields.length; i++) {
            setFieldState(frame, form, fields[i], state);
        }
    }


    // To avoid multiple parsing of query params for each frame, parse them
    // once here.
    $H.on(
        {
            search: function(search/**/, i, j, name, value, cur) {
                // Reset active flags.
                cur = function(r) { r._a = 0; };
                for (i = frames.length; i--;) {
                    traverseFrame(frames[i], cur);
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


    function addFrame(uri, frameSettings/**/, frame) {
        frame = new Frame(uri, frameSettings);
        frames.push(frame);
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


    function emitEvent(event, frame, args/**/, handlers, cur, i) {
        if ((handlers = eventHandlers[event])) {
            args = [].concat(event, args || []);

            // Specific frame handlers.
            if (((i = frame._id)) && ((cur = handlers[i]))) {
                for (i = 0; i < cur.length; i++) {
                    cur[i].apply(frame, args);
                }
            }

            // General frame handlers.
            if ((cur = handlers[''])) {
                for (i = 0; i < cur.length; i++) {
                    cur[i].apply(frame, args);
                }
            }
        }
    }


    function pushParam(part, params, allowDuplicates, pathParams/**/, type, parent) {
        parent = 1;
        if (allowDuplicates) {
            // Allow parent frame params in data URIs.
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


    function deactivateFrame(frame/**/, a) {
        if ((a = frame._a)) {
            while (frame) {
                // Tell parents about it.
                frame._a -= a;
                frame = frame[KEY_PARENT];
            }
        }
    }


    function Frame(uri, frameSettings, pathExpr, paramsOffset, parent, form) {
        var self = this,
            i,
            childFrames,
            f,
            frame = /.*/, // Default value is for NotFound frame.
            childFrame,
            pathnameExpr,
            pathParams,
            uriSearch,
            uriHash,
            paramsConstraints,
            currentParams = {};

        self[KEY_PARENT] = parent;
        self.children = [];
        self.uri = uri;
        self._id = 'r' + (++frameId);
        self._n = {};

        if (frameSettings) {
            paramsConstraints = frameSettings.params;
            self.title = frameSettings.title || (parent && parent.title);
            self[KEY_RENDER_PARENT] = frameSettings[KEY_PARENT] || (parent && parent[KEY_RENDER_PARENT]);
            self.render = f = normalizeRender(frameSettings.render);
            self.final = frameSettings.final;

            if (form) {
                self.isForm = true;
                self.action = frameSettings.action;
                self._method = frameSettings.method;
                self.check = frameSettings.check;
                self.state = frameSettings.state;
                self.type = frameSettings.type;
                self[STR_SUBMIT] = frameSettings[STR_SUBMIT];
            } else {
                if ((i = self.id = frameSettings.id)) {
                    if (i in frameById) { throwError('Duplicate id: ' + i); }
                    frameById[i] = self;
                }
                self.keep = frameSettings.keep;
                self[KEY_DATASOURCE] = frameSettings.data;
                self.form = frameSettings.form;
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

            frame = function(pathname) {
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
                            deactivateFrame(self);
                            return false;
                        }
                    }

                    // self._d means that there are no further pathname components.
                    // self._a means active frame.
                    if ((self._d = !match[paramsOffset + pathParams.length])) {
                        // Deepest matched frame and there is render for this frame.
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
                frame = {pathname: frame};

                if (uriSearch) {
                    frame.search = function() {
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
                                deactivateFrame(self);
                                return false;
                            }
                        }

                        return queryparams;
                    };
                }

                if (uriHash) {
                    frame.hash = function(hash) {
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
                            deactivateFrame(self);
                        }

                        return i;
                    };
                }
            }

            if ((childFrames = frameSettings && frameSettings.frames)) {
                for (f in childFrames) {
                    childFrame = new Frame(
                        f,
                        childFrames[f],
                        pathExpr,
                        paramsOffset + pathParams.length,
                        self
                    );

                    self.children.push(childFrame);
                }
            }
        }

        $H.on(frame, {
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


    function getURIParam(frame, param, overrideParams/**/, i, name) {
        name = param.param;

        if (overrideParams && (name in overrideParams)) {
            i = overrideParams[name];
        } else {
            i = param[KEY_PARENT];

            while (frame && i) {
                frame = frame[KEY_PARENT];
                i--;
            }

            i = ((i = frame && frame._p)) ? i[name] : undefined;
        }

        return i;
    }


    function makeURI(frame, uri, overrideParams, pathname, queryparams, processedQueryparams, hash, child) {
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
            val = part.param ? getURIParam(frame, part, overrideParams) : part;

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
                        val = getURIParam(frame, part, overrideParams);
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
            hash = pathObj.param ? getURIParam(frame, pathObj, overrideParams) : pathObj.value;
        }

        if (overrideParams && frame && ((i = frame[KEY_PARENT]))) {
            // Building frame URI from frames tree, current state and params to override.
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


    function AJAX(uri, frame, body/**/, req, self, parse, override, transform, response, uriReady) {
        self = this;

        // self.ok — Success callbacks.
        // self.err — Error callbacks.
        // self.d — Done.
        // self.e — Error.
        // self.r = XMLHTTRequest.
        // self.j = Parsed response JSON.

        if (!isString(uri)) {
            if (((override = uri.override)) &&
                (((override = override.call(frame, frame._p))) !== undefined))
            {
                return {d: override};
            }

            parse = uri.parse;
            transform = uri.transform;
            uri = uri.uri;
            if (isFunction(uri)) {
                uri = uri.call(frame, frame._p);
                uriReady = true;
            }
        }

        self.ok = [];
        self.err = [];

        self.r = req = new XMLHttpRequest();

        req.open(
            frame.method || 'GET',
            (req.uri = uriReady ? uri : makeURI((frame = frame.isForm ? frame[KEY_PARENT] : frame), uri)),
            true
        );
        req.onreadystatechange = function() {
            if (req.readyState === 4) { // Completed.
                self.d = self.e = true;
                if (req.status === 200) {
                    try {
                        response = req.responseText;
                        response = parse ? parse.call(frame, response, req) : JSON.parse(response);
                        self.j = transform ? transform.call(frame, response, req) : response;
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

        if (body === CANCELLED) {
            return body;
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


    function getRenderParent(frame, parent1, parent2/**/, id, n) {
        parent1 = parent1 || parent2 || defaultParent;

        if (parent1 && !isNode(parent1)) {
            if (isFunction(parent1)) {
                parent1 = parent1.call(frame);
            } else {
                parent1 = document.querySelector(parent1);
            }
        }

        if ((parent1 = isNode(parent1) ? parent1 : NULL)) {
            if (!((id = parent1._$Cid))) {
                parent1._$Cid = id = ++frameId;
            }
            // Add placeholder for this frame in this parent node.
            n = (frame.isForm ? frame[KEY_PARENT] : frame)._n;
            if (!(n[id])) {
                n[id] = [(parent2 = document.createComment(''))];
                parent1.appendChild(parent2);
            }
        }

        return parent1;
    }


    function processRender(stage, render, datas, defaultRenderParent, frame, formNode, renderParents, target) {
        var i,
            mem,
            params,
            node,
            parent,
            renderParent,
            renderParentId,
            placeholder,
            args,
            ret,
            n,
            rememberedNodes,
            KEY_NEXT_SIBLING = 'nextSibling';

        if (target === undefined) {
            target = render[stage] || defaultRender[stage] || [];
        }

        if (isArray(target)) {
            if (stage === STR_EXCEPT && !target.length) {
                throw datas[0];
            }

            try {
                renderParents = {};
                for (i = 0; i < target.length; i++) {
                    if (processRender(stage, render, datas, defaultRenderParent, frame, formNode, renderParents, target[i]) === false) {
                        break;
                    }
                }
            } catch(e) {
                datas = [e, stage, i, target[i]];
                processRender(STR_EXCEPT, render, datas, defaultRenderParent, frame, formNode, renderParents);
                emitEvent(STR_EXCEPT, frame, datas);
                ret = true;
            }
        } else if (target || target === NULL) {
            // null-value target could be used to remove previous render nodes.
            renderParent = getRenderParent(frame, target && target[KEY_PARENT], defaultRenderParent);
            if (renderParent) {
                rememberedNodes = (frame.isForm ? frame[KEY_PARENT] : frame)._n;
                mem = rememberedNodes[(renderParentId = renderParent._$Cid)];
                placeholder = mem[0];
                params = frame._p;

                if (target) {
                    args = [].concat(datas, params, frame);
                    if (formNode) { args.push(formNode); }
                    if (isFunction(target)) {
                        node = target.apply(frame, args);
                        if (node === false) { return node; }
                        if (node === NULL) { target = NULL; }
                        if (isString(node)) { i = node; }
                    } else {
                        i = isString(target) ? target : target.template;
                        if (isFunction(i)) { node = i = i.apply(frame, args); }
                    }

                    if (isString(i)) {
                        node = callTemplateFunc.call(frame, i, args);
                        if (isString(node)) {
                            // We've got string of HTML, create documentFragment
                            // from it.
                            i = document.createElement('div');
                            i.innerHTML = node;
                            node = document.createDocumentFragment();
                            i = i.firstChild;
                            while (i) {
                                n = i[KEY_NEXT_SIBLING];
                                node.appendChild(i);
                                i = n;
                            }
                        }
                    }

                    if (node === false) { return node; }
                }

                if (!target || isNode(node)) {
                    // Remove nodes from previous frames if any.
                    removeNodes(oldDOM, 0);

                    if (!((renderParentId in renderParents) || (target && (target.replace === false)))) {
                        // By default we are replacing everything from previous
                        // render of this frame in this parent.

                        // renderParents._ is a flag that this stage has DOM already.
                        for (i in rememberedNodes) {
                            i = rememberedNodes[i];
                            if (!renderParents._ || i === mem) {
                                removeNodes(i, 1);
                            }
                        }
                    }

                    renderParents[renderParentId] = renderParents._ = true;

                    if (target) {
                        if ((parent = placeholder.parentNode)) {
                            n = placeholder.previousSibling;
                            parent.insertBefore(node, placeholder);
                            // Remember frame's inserted nodes.
                            for (i = n ? n[KEY_NEXT_SIBLING] : parent.firstChild; i !== placeholder; i = i[KEY_NEXT_SIBLING]) {
                                mem.push(i);
                                i[KEY_FRAME] = frame;
                            }
                        }
                    }
                }
            }
        }

        return ret;
    }


    function removeNodes(nodes, stop/**/, parent, node) {
        while (nodes.length > stop) {
            node = nodes.pop();
            if ((parent = node.parentNode)) {
                parent.removeChild(node);
            }
        }
    }


    function ProcessFrame(frame, formNode, formBody) {
        if (frame._data instanceof ProcessFrame) { return; }

        var skip = (frame._data !== undefined) && !frame[KEY_DATAERROR],
            self = this,
            datas = self.datas = [],
            dataSource = frame[KEY_DATASOURCE],
            i,
            d,
            waiting = 0,
            render = frame.render,
            defaultRenderParent,
            resolve,
            done = function(index, data, /**/i, children, r, errors) {
                if (index !== undefined) {
                    datas[index] = data;
                    waiting--;
                }

                if (!waiting && !self.rejected) {
                    errors = frame[KEY_DATAERROR];
                    children = frame.children;

                    if (!skip) {
                        frame._data = datas;

                        if (frame.isForm) {
                            setFormState(frame[KEY_PARENT], frame, FORM_STATE_VALID);
                        }

                        i = errors ? STR_ERROR : STR_SUCCESS;
                        if (processRender(i, render, errors || datas, defaultRenderParent, frame, formNode)) {
                            return;
                        }
                        emitEvent(i, frame, errors || datas);

                        if (processRender(STR_AFTER, render, errors ? [true] : [], defaultRenderParent, frame, formNode)) {
                            return;
                        }
                        emitEvent(STR_AFTER, frame);
                    }

                    if (!errors) {
                        for (i = 0; i < children.length; i++) {
                            r = children[i];
                            if (r._id in currentFrames) {
                                new ProcessFrame(r);
                            }
                        }
                    }
                }
            };

        if (!skip) {
            frame._data = self;

            defaultRenderParent = getRenderParent(frame, frame[KEY_RENDER_PARENT]);

            document.title = (i = (isFunction((i = frame.title)) ? i() : i)) === undefined
                ?
                defaultTitle
                :
                i;

            if (processRender(STR_BEFORE, render, [], defaultRenderParent, frame, formNode)) {
                return;
            }
            emitEvent(STR_BEFORE, frame);

            if (dataSource !== undefined) {
                if (!isArray(dataSource)) {
                    dataSource = [dataSource];
                }

                resolve = function(index) {
                    waiting++;
                    d.then(function(ok) {
                        done(index, ok);
                    }, function(xhr, errors) {
                        if (!((errors = frame[KEY_DATAERROR]))) {
                            errors = frame[KEY_DATAERROR] = new Array(datas.length);
                        }
                        errors[index] = xhr;
                        done(index);
                    });
                };

                for (i = 0; i < dataSource.length; i++) {
                    if ((d = dataSource[i])) {
                        if (isString(d) || isFunction(d.uri) || isString(d.uri)) {
                            d = new AJAX(d, frame, formBody);
                            // When AJAX request is cancelled, constructor returns
                            // object {d: ...} which is not instance of AJAX.
                            if (!d.then) { d = d.d; }
                        }

                        if (isFunction(d)) {
                            d = d.call(frame);
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


    ProcessFrame.prototype.reject = function() {
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


    function unprocessFrame(frame, activeFrames, keepPlaceholders) {
        var children,
            i,
            nodesets,
            nodes;

        children = frame.children;
        for (i = children.length; i--;) {
            unprocessFrame(children[i], activeFrames);
        }

        // Stop processing frame and remove associated nodes.
        if (frame._data && isFunction(frame._data.reject)) {
            frame._data.reject();
            if (frame.isForm && !frame._c) {
                unprocessFrame(frame[KEY_PARENT], activeFrames, true);
            }
            emitEvent('stop', frame);
        }

        if (frame._data !== undefined) {
            frame._data = frame[KEY_DATAERROR] = undefined;
            emitEvent('leave', frame);

            if (!(frame._id in activeFrames)) {
                nodesets = frame._n;
                keepPlaceholders = keepPlaceholders ? 1 : 0;

                for (i in nodesets) {
                    nodes = nodesets[i];
                    while (nodes.length > keepPlaceholders) {
                        oldDOM.push(nodes.pop());
                    }
                }

                if (!keepPlaceholders) {
                    frame._n = {};
                }
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
