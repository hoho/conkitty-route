/*!
 * conkitty-route v0.7.1, https://github.com/hoho/conkitty-route
 * (c) 2014 Marat Abdullin, MIT license
 */

/* global $H */
window.$CR = (function(document, decodeURIComponent, encodeURIComponent, location, setTimeout, clearTimeout, undefined) {
    'use strict';

    var defaultTitle,
        defaultRender,
        defaultParent,

        callTemplateFunc,

        running,

        currentQueryParams,
        currentFrames = {},
        currentRootFrame,

        reloadCurrent,

        frames = [],
        frameId = 0,

        frameById = {},

        notFoundFrame,

        oldDOM = [],

        partials,

        eventHandlers = {
            before: {},
            success: {},
            error: {},
            after: {},
            stop: {},
            except: {},
            leave: {},
            busy: {},
            idle: {},
            xhr: {}
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

        KEY_MATCHES_SELECTOR = 'matches',

        proto = Frame.prototype,

        InternalValue = function(type) {
            this._ = type;
        },

        isInternalValue = function(type, value) {
            return (value instanceof InternalValue) && value._ === type;
        },

        ParamsObject = function() {},

        createParamsObject = function(params, parent) {
            var Params = function(p) {
                    for (p in params) {
                        this[p] = params[p];
                    }
                };
            Params.prototype = parent || new ParamsObject();
            return new Params();
        },

        API = function add(uri, isName, frameSettings) {
            checkRunning();

            if (frameSettings === undefined) {
                frameSettings = isName;
                isName = false;
            }

            if (isString(uri) && isString(frameSettings)) {
                // It's a redirect.
                addFrame(uri, {
                    render: function(data, params) {
                        API.set(
                            makeURI(undefined, frameSettings, params),
                            undefined,
                            true
                        );
                    }
                });
            } else {
                if (uri) {
                    addFrame(uri, frameSettings, isName);
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
            addEvent = body.addEventListener.bind(body),
            prefixes = ['oM', 'msM', 'mozM', 'webkitM', 'm'];

        while (KEY_MATCHES_SELECTOR && !body[KEY_MATCHES_SELECTOR]) {
            KEY_MATCHES_SELECTOR = prefixes.pop() + 'atchesSelector';
        }

        defaults = defaults || {};

        defaultTitle = defaults.title;
        defaultRender = normalizeRender(defaults.render);
        defaultParent = defaults[KEY_PARENT] || body;
        callTemplateFunc = defaults.callTemplate || function(name, data, params, formNode/**/, tpl, args) {
            /* global $C */
            if (!((tpl = $C.tpl[name]))) { throwError('No `' + name + '` template'); }
            args = [data, params, this];
            if (formNode) { args.push(formNode); }
            return tpl.apply(NULL, args);
        };

        if (notFoundFrame) {
            addFrame(undefined, notFoundFrame);
        }

        $H.on(undefined, function() {
            var newRootFrame,
                newFrames = {},
                i,
                j,
                frame,
                haveNewFrames,
                newFramesCount = 0,
                currentFramesCount = 0,
                traverseCallbackBefore = function(f) {
                    f._w = 0;
                },
                traverseCallback = function(f/**/, tmp, brk) {
                    if (f._a) {
                        // frame._w is a number of active frames in current branch, for
                        // `wait: true` and autorefresh.
                        f._w++;
                        newFrames[(tmp = f._id)] = f;
                        newFramesCount++;
                        if (!haveNewFrames && !(tmp in currentFrames)) {
                            haveNewFrames = true;
                        }
                        if (isFunction((brk = f.break))) {
                            brk = brk.call(f);
                        }
                        if ((tmp = f[KEY_PARENT])) {
                            tmp._w += f._w;
                        }
                        return !!brk;
                    }
                },
                activateParallelFramesCallback = function(f/**/, parallel, j, s) {
                    // Check if there are parallel frames.
                    if ((parallel = f._g)) {
                        for (j = parallel.length; j--;) {
                            // Check if at least one active frame among the
                            // arallel frames exists.
                            if (((s = parallel[j]))._a) {
                                s = s._s;
                                for (j = parallel.length; j--;) {
                                    // Activate the inactive parallel frames.
                                    if (!((f = parallel[j]))._a && (f.final !== false)) {
                                        setFrameActiveFlag(f, 1);
                                    }
                                    f._s = s;
                                }
                                break;
                            }
                        }
                    }
                };

            for (i = 0; i < frames.length; i++) {
                frame = frames[i];
                if (frame._a) {
                    newRootFrame = frame;
                    for (j in partials) {
                        frame = partials[j];
                        if (frame.root === newRootFrame && !frame._a) {
                            setFrameActiveFlag(frame, 1);
                        }
                    }
                    traverseFrame(newRootFrame, undefined, activateParallelFramesCallback);
                    traverseFrame(newRootFrame, traverseCallbackBefore, traverseCallback);
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
            currentRootFrame = newRootFrame;

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
                action,
                type,
                submit,
                cancelled;

            while (target && !((frame = target[KEY_FRAME]))) {
                target = target.parentNode;
            }

            if (frame && frame.form) {
                if (((submit = frame.checkForm(formNode))) !== undefined) {
                    e.preventDefault();
                    form = formNode[KEY_FRAME + 'f'];
                }

                if (submit) {
                    currentFrames[form._id] = form;

                    data = form._se; // Serialized form data.
                    form.method = (formNode.getAttribute('method') || form._method || 'get').toLowerCase();

                    data = (submit = form[STR_SUBMIT]) ?
                        submit.call(formNode, data, frame, function() { cancelled = true; })
                        :
                        data;

                    if (!cancelled) {
                        if (data && isFunction(data.then)) {
                            data.then(submitForm);
                        } else {
                            submitForm(data);
                        }
                    }
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

            function submitForm(data) {
                action = isFunction((action = formNode.getAttribute('action') || form.action)) ?
                    action.call(formNode, data, frame)
                    :
                    (action || location.href);

                type = form.type || 'qs';

                if (form.method === 'get' && type === 'qs') {
                    if (data.length) {
                        action += (~action.indexOf('?') ? '&' : '?') + formToQuerystring(data);
                    }
                    data = undefined;
                }

                if (type === 'qs' && (!data || !data.length)) {
                    data = type = undefined;
                }

                form[KEY_DATASOURCE] = [action];

                new ProcessFrame(
                    form,
                    undefined,
                    formNode,
                    function(xhr/**/, xhrCallback) {
                        if (data !== undefined || type !== undefined) {
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
                        }

                        if ((xhrCallback = form.xhr)) {
                            xhrCallback.call(formNode, xhr, data, frame);
                        }

                        setFormState(frame, form, FORM_STATE_SENDING);

                        return type === 'json' ?
                            JSON.stringify(data)
                            :
                            (data ?
                                (type === 'text' ?
                                    data + ''
                                    :
                                    formToQuerystring(data || []))
                                :
                                undefined);
                    }
                );
            }
        });

        running = true;
        $H.run();

        // Exposing debug information.
        API._debug = {f: frames, o: oldDOM};
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


    function traverseFrame(frame, callbackBefore, callback, childrenOnly/**/, i, children, f, ret) {
        if (!childrenOnly && callbackBefore) {
            callbackBefore(frame);
        }
        children = frame.children;
        for (i = 0; i < children.length; i++) {
            ret = traverseFrame((f = children[i]), callbackBefore, callback);
            if (ret) { break; }
        }
        return !childrenOnly && callback && callback(frame);
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


    API.$ = {
        uri: function(uri, params, reload, replace) {
            var ret = new InternalValue(1); // Magic number 1: URI.
            ret.u = uri;
            ret.p = params;
            ret.r = reload;
            ret.e = replace;
            return ret;
        },

        static: function(value) {
            var ret = new InternalValue(2); // Magic number 2: Static data.
            ret.v = value;
            return ret;
        },

        tpl: function(name, parent, replace) {
            var ret = new InternalValue(3); // Magic number 3: Template.
            ret.n = name;
            ret.p = parent;
            ret.r = replace;
            return ret;
        },

        data: function(value) {
            var ret = new InternalValue(4); // Magic number 4: Data with additional
                                            // processing functions.
            if (!value || !value.uri) { throwError('No URI'); }
            ret.v = value;
            return ret;
        },

        refresh: function(settings) {
            var ret = new InternalValue(5), // Magic number 5: Automatic background
                r,                          // refresh timeout.
                i,
                t = settings.tags,
                tags = {};

            if (!isFunction((r = ret.r = settings.refresh)) && typeof r !== 'number' && (!t || !isString(t))) {
                throwError('Wrong refresh');
            }
            ret.o = settings.timeout;
            ret.j = ((r = settings.join)) === undefined ? true : r;

            if (t) {
                t = t.split(whitespace);
                for (i = t.length; i--;) {
                    tags[t[i]] = true;
                }
            }
            ret.t = tags;

            return ret;
        }
    };


    API.refresh = function refresh(tags) {
        tags = tags.split(whitespace);
        traverseFrame(currentRootFrame, undefined, function(frame/**/, settings, frameTags, i) {
            if (frame._id in currentFrames && ((settings = frame.refresh)) && ((frameTags = settings.t))) {
                for (i = tags.length; i--;) {
                    if (tags[i] in frameTags) {
                        refreshFrame(frame, 0, settings, true);
                    }
                }
            }
        });
    };


    proto.reload = function() {
        var self = this,
            parent;

        if (self._id in currentFrames) {
            parent = self[KEY_PARENT];
            while (parent) {
                // Check if none of parent frames is in progress.
                if (parent._l) {
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


    proto.params = function() {
        return this._p || undefined;
    };


    proto.data = function(index) {
        var d = this._data;
        return isArray(d) ? (index === -1 ? d : d[index || 0]) : undefined;
    };


    proto.makeURI = function(params) {
        return makeURI(this, this.uri, params || {});
    };


    proto.active = function(andPrev) {
        return (this._id in currentFrames) && (andPrev ? this._s === 1 : true);
    };


    proto.checkForm = function(formNode) {
        var i = formNode,
            j,
            settings,
            tmp,
            frame = this,
            form,
            data,
            fields,
            check,
            field,
            error,
            hasError;

        while (i && !((tmp = i[KEY_FRAME]))) {
            i = i.parentNode;
        }

        if (frame === tmp && ((i = frame.form))) {
            if (!((form = formNode[(tmp = KEY_FRAME + 'f')]))) {
                if (!isArray(i)) { i = [i]; }

                for (j = 0; j < i.length; j++) {
                    settings = i[j];
                    if (!settings.match || formNode[KEY_MATCHES_SELECTOR](settings.match)) {
                        form = formNode[tmp] = new Frame(
                            undefined,
                            undefined,
                            undefined,
                            settings, // frameSettings
                            undefined,
                            undefined,
                            frame, // parent
                            true // form
                        );
                        break;
                    }
                }
            }

            if (form) {
                data = serializeForm(formNode, true);
                fields = form._fi = data[1];
                form._se = data = data[0];
                check = form.check;

                for (i = 0; i < fields.length; i++) {
                    field = fields[i];
                    error = check ? check.call(frame, field[0], field[1], data) : undefined;
                    setFieldState(
                        frame,
                        form,
                        field,
                        error ? ((hasError = true), FORM_STATE_INVALID) : FORM_STATE_VALID,
                        error
                    );
                }

                return !hasError;
            }
        }
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
        var fields = form._fi,
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
                // Reset partials.
                partials = {};

                // Reset active flags.
                cur = function(r) { r._a = 0; };
                for (i = frames.length; i--;) {
                    traverseFrame(frames[i], undefined, cur);
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


    function addFrame(uri, frameSettings, isName) {
        new Frame(frames, undefined, uri, frameSettings);
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
            frame = frame.isForm ? frame[KEY_PARENT] : frame;

            args = [event].concat(args || []);

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


    function pushParam(part, params, allowDuplicates, pathParams/**/, type) {
        type = part.charAt(1) === '?' ? 2 : 1;
        part = part.substring(type);
        // Allow duplicates in data URIs.
        if ((part in params) && !allowDuplicates) {
            throwError('Duplicate param');
        }
        params[part] = type;
        part = {param: part, optional: type === 2};
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


    function checkAndSetParam(frame, name, value, expected, constraints, queryParams, newParams, currentParams/**/, constraint, ok) {
        if (expected.param && constraints) {
            constraint = constraints[expected.param];
        }

        switch (true) {
            case 'value' in expected ? expected.value === value : (value !== undefined && !constraint):
                ok = true;
                break;

            case isFunction(constraint):
                ok = (((value = constraint.call(frame, value, newParams))) !== undefined) || expected.optional;
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
            if (name !== undefined) { queryParams[name] = value; }
            if (expected && ((name = expected.param))) {
                // Using different objects to avoid wrong Histery.js sameMatch.
                newParams[name] = currentParams[name] = value;
            }
        }

        return ok;
    }


    function setFrameActiveFlag(frame, active/**/, a) {
        // frame._a means active frame.
        if (!!((a = frame._a)) === !active) {
            while (frame) {
                // Tell parents about it.
                frame._a += (active || -a);
                frame = frame[KEY_PARENT];
            }
        }
    }


    function Frame(array, parallel, uri, frameSettings, pathExpr, paramsOffset, parent, form) {
        var self = this,
            i,
            childFrames,
            f,
            tmp,
            events,
            frame = /.*/, // Default value is for NotFound frame.
            pathnameExpr,
            pathParams,
            uriSearch,
            uriHash,
            paramsConstraints,
            currentParams = self._p = createParamsObject({}, parent && parent._p),
            newParams,
            newPathExpr,
            processedParams;

        self[KEY_PARENT] = parent;
        self.root = parent ? (parent.root || parent) : self;
        self.children = [];
        self.uri = uri;
        self._id = 'r' + (++frameId);
        self._n = {};

        if (frameSettings) {
            self.title = frameSettings.title || (parent && parent.title);
            self[KEY_RENDER_PARENT] = frameSettings[KEY_PARENT] || (parent && parent[KEY_RENDER_PARENT]);
            self.render = normalizeRender(frameSettings.render);

            if (form) {
                self.isForm = true;
                if ((tmp = self.action = frameSettings.action)) {
                    checkDataSource(tmp);
                }
                self._method = frameSettings.method;
                self.check = frameSettings.check;
                self.state = frameSettings.state;
                self.type = frameSettings.type;
                self[STR_SUBMIT] = frameSettings[STR_SUBMIT];
                self.xhr = frameSettings.xhr;

            } else {
                array.push(self);
                if (parallel) {
                    self._g = parallel;
                    parallel.push(self);
                }

                paramsConstraints = frameSettings.params;
                if ((i = self.id = frameSettings.id)) {
                    if (i in frameById) { throwError('Duplicate id: ' + i); }
                    frameById[i] = self;
                }
                self.break = frameSettings.break;
                self.keep = frameSettings.keep;
                self.final = frameSettings.final;
                self.partial = frameSettings.partial;
                self.reduce = frameSettings.reduce;

                if (isArray((f = frameSettings.data))) {
                    self._da = true; // Indicate that it is an Array originally.
                } else {
                    f = f !== undefined ? [f] : [];
                }
                for (i = 0; i < f.length; i++) {
                    checkDataSource(f[i]);
                }
                self[KEY_DATASOURCE] = f;

                self.form = frameSettings.form;
                self.wait = ((i = frameSettings.wait) === undefined ? parent && parent.wait : i) || false;

                if ((events = frameSettings.on)) {
                    for (tmp in eventHandlers) {
                        if ((f = events[tmp])) {
                            if (!isArray(f)) { f = [f]; }
                            for (i = 0; i < f.length; i++) {
                                API.on(tmp, f[i], self);
                            }
                        }
                    }
                }
            }

            if ((i = tmp = frameSettings.refresh)) {
                i = isInternalValue(5, i) ? i : API.$.refresh({refresh: i});
                if (form) {
                    self.tags = Object.keys(i.t).join(' ');
                } else {
                    self.refresh = i;
                }
            }
        }

        if (uri !== undefined) {
            uri = parseParameterizedURI(uri);
            newPathExpr = (pathExpr || []).concat(uri.pathname[0]);

            pathnameExpr = new RegExp('^' + newPathExpr.join('') + '(?:/(.*))?$');
            pathParams = uri.pathname[1];
            uriSearch = uri.search;
            uriHash = uri.hash;

            if (!paramsOffset) { paramsOffset = 1; }

            frame = function(pathname) {
                processedParams = {};
                newParams = {};

                var match = pathname.match(pathnameExpr),
                    j;

                if (match) {
                    for (j = 0; j < pathParams.length; j++) {
                        if (!checkAndSetParam(
                                self,
                                undefined,
                                match[paramsOffset + j],
                                (tmp = pathParams[j]),
                                paramsConstraints,
                                undefined,
                                newParams,
                                currentParams)
                            )
                        {
                            j = false;
                            break;
                        }

                        if (tmp && ((tmp = tmp.param))) { processedParams[tmp] = true; }
                    }

                    if (j === false || (!uriSearch && !uriHash && !finishMatching())) {
                        setFrameActiveFlag(self);
                        return false;
                    }

                    if ((((j = !match[paramsOffset + pathParams.length])) || self.partial) && self.final !== false) {
                        if (j) {
                            setFrameActiveFlag(self, 1);
                        } else {
                            j = true;
                            partials[self._id] = self;
                        }
                    }
                }

                return self._a || j ? newParams : false;
            };


            if (uriSearch || uriHash) {
                frame = {pathname: frame};

                if (uriSearch) {
                    frame.search = function() {
                        var queryParams = {},
                            queryparam;

                        for (queryparam in uriSearch) {
                            if (!checkAndSetParam(
                                    self,
                                    queryparam,
                                    currentQueryParams[queryparam],
                                    (tmp = uriSearch[queryparam]),
                                    paramsConstraints,
                                    queryParams,
                                    newParams,
                                    currentParams)
                                )
                            {
                                queryParams = false;
                                break;
                            }

                            if (tmp && ((tmp = tmp.param))) { processedParams[tmp] = true; }
                        }

                        if (queryParams === false || (!uriHash && !finishMatching())) {
                            setFrameActiveFlag(self);
                            queryParams = false;
                        }

                        return queryParams;
                    };
                }

                if (uriHash) {
                    frame.hash = function(hash) {
                        var j = checkAndSetParam(
                                self,
                                undefined,
                                hash || undefined,
                                uriHash,
                                paramsConstraints,
                                undefined,
                                newParams,
                                currentParams
                            )
                            &&
                            finishMatching()
                            ?
                            hash || true
                            :
                            false;

                        if (!j) {
                            setFrameActiveFlag(self);
                        }

                        if ((tmp = uriHash.param)) { processedParams[tmp] = true; }

                        return j;
                    };
                }
            }

            if ((childFrames = frameSettings && frameSettings.frames)) {
                for (f in childFrames) {
                    if (isArray((tmp = childFrames[f]))) {
                        parallel = [];
                    } else {
                        tmp = [tmp];
                        parallel = undefined;
                    }
                    for (i = 0; i < tmp.length; i++) {
                        new Frame(
                            self.children,
                            parallel,
                            f,
                            tmp[i],
                            self.reduce === false ? pathExpr : newPathExpr,
                            paramsOffset + (self.reduce === false ? 0 : pathParams.length),
                            self
                        );
                    }
                }
            }
        }

        if (!form) {
            $H.on(frame, {
                go: function(same) {
                    if (!uri) {
                        // It's not found target, no URI matching functions have
                        // been called, set active flag here.
                        self._a = 1;
                    }
                    self._s = same;
                }
            });
        }


        function checkDataSource(ds) {
            if (!ds || !(isInternalValue(2, ds) || isInternalValue(4, ds) || isString(ds) || isFunction(ds))) {
                throwError('Unexpected `' + ds + '` as data source');
            }
        }

        function finishMatching(/**/matcher, name, val, k) {
            val = Object.keys(currentParams);
            for (k = val.length; k--;) {
                name = val[k];
                if (!newParams.hasOwnProperty(name)) {
                    delete currentParams[name];
                }
            }

            // Calculable parameters.
            for (name in paramsConstraints) {
                if (!(name in processedParams)) {
                    val = paramsConstraints[name];
                    if (((val = isFunction(val) ? val.call(self) : val)) !== undefined) {
                        currentParams[name] = val;
                    }
                }
            }

            // Run custom matcher if any.
            return (matcher = frameSettings.matcher) ? matcher.call(self, currentParams) : true;
        }
    }


    function normalizeRender(render) {
        render = isTemplate(render) || isArray(render)
            ?
            {success: render}
            :
            render || {};

        var ret = {},
            i,
            j,
            k,
            key,
            val,
            val2,
            tpl,
            RENDER_KEYS = [STR_BEFORE, STR_SUCCESS, STR_ERROR, STR_AFTER, STR_EXCEPT],
            SUBSTAGES = {'-': false, '': undefined, '+': true};

        for (i = RENDER_KEYS.length; i--;) {
            j = '';
            val2 = undefined;
            for (j in SUBSTAGES) {
                if (!isArray((val = render[j + ((key = RENDER_KEYS[i]))])) && val !== undefined) {
                    val = [val];
                }
                if (val) {
                    if (!val2) { val2 = []; }
                    for (k = 0; k < val.length; k++) {
                        if (!isTemplate((tpl = val[k]))) {
                            throwError('Unexpected `' + tpl + '` as a template');
                        }
                        val2.push({s: SUBSTAGES[j], v: tpl});
                    }
                    ret[key] = val2;
                }
            }
        }

        return ret;

        function isTemplate(candidate) {
            return isString(candidate) ||
                   isFunction(candidate) ||
                   isInternalValue(1, candidate) ||
                   isInternalValue(3, candidate) ||
                   candidate === NULL;
        }
    }


    function getURIParam(frame, param, overrideParams/**/, name) {
        name = param.param;
        return (overrideParams && (name in overrideParams) ? overrideParams : frame._p)[name];
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

        if (overrideParams !== undefined && (typeof overrideParams !== 'object')) {
            throwError('Invalid params `' + overrideParams + '`');
        }

        if (!frame || (frame && frame.reduce !== false)) {
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


    function AJAX(uri, frame, body/**/, req, self, parse, override, transform, response, uriReady, method) {
        self = this;

        // self.ok — Success callbacks.
        // self.err — Error callbacks.
        // self.d — Done.
        // self.e — Error.
        // self.r = XMLHTTRequest.
        // self.j = Parsed response JSON.

        method = frame.method;
        frame = frame.isForm ? frame[KEY_PARENT] : frame;

        if (isInternalValue(4, uri) && ((uri = uri.v))) {
            if (((override = uri.override)) &&
                (((override = override.call(frame, frame._p))) !== undefined))
            {
                return {o: override};
            }

            method = uri.method || method;
            parse = uri.parse;
            transform = uri.transform;
            uri = uri.uri;
            if (isFunction(uri)) {
                uri = uri.call(frame, frame._p);
                uriReady = true;
            }
        }

        if (isFunction(method)) {
            method = method.call(frame, frame._p);
        }

        self.ok = [];
        self.err = [];

        self.r = req = new XMLHttpRequest();

        req.open(
            (req.method = (method || 'GET').toUpperCase()),
            (req.uri = uriReady ? uri : makeURI(frame, uri)),
            true
        );

        emitEvent('xhr', frame, [req, false]);

        req.onreadystatechange = function() {
            if (req.readyState === 4) { // Completed.
                emitEvent('xhr', frame, [req, true]);
                self.d = self.e = true;
                if (((req.status / 100) | 0) === 2) { // A clever Math.ceil(req.status / 100) === 2
                    try {
                        // TODO: Look at HTTP status codes and handle them more carefully.
                        response = req.responseText;
                        response = parse ? parse.call(frame, response, req) : (req.status === 204 ? undefined : JSON.parse(response));
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


    function getRenderParent(frame, parent1, parent2/**/, src, id, n) {
        src = parent1;
        frame = frame.isForm ? frame[KEY_PARENT] : frame;
        if (isString(parent2)) { parent2 = undefined; }
        parent1 = parent1 || parent2 || defaultParent;

        if (parent1 && !isNode(parent1)) {
            if (isFunction(parent1)) {
                parent1 = parent1.call(frame);
            } else {
                parent1 = document.querySelector(parent1);
            }
        }

        if (isNode(parent1)) {
            if (!((id = parent1._$Cid))) {
                parent1._$Cid = id = ++frameId;
            }
            // Add placeholder for this frame in this parent node.
            n = frame._n;
            if (!(n[id])) {
                n[id] = [(parent2 = document.createComment(''))];
                parent1.appendChild(parent2);
            }
        } else {
            parent1 = 'No node `' + src + '`' + ((src = frame.id) ? ' (' + src + ')' : '');
        }

        return parent1;
    }


    function processRender(stage, render, datas, defaultRenderParent, frame, formNode, renderParents, target) {
        var i,
            mem,
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

        target = target === undefined ?
            (render[stage] || defaultRender[stage] || [])
            :
            (target.s === undefined || target.s === frame.active(true) ? target.v : undefined);

        if (isArray(target)) {
            if (stage === STR_EXCEPT && !target.length) {
                throw datas[0];
            }

            try {
                renderParents = {};

                if (!target.length && ((stage === STR_SUCCESS) || (stage === STR_ERROR))) {
                    // Frame has no render for success or error stage, but has
                    // some DOM (other than placeholders) from defaultRender —
                    // remove this DOM.
                    rememberedNodes = frame._n;
                    for (i in rememberedNodes) {
                        if (rememberedNodes[i].length > 1) {
                            target = [{v: NULL}];
                            break;
                        }
                    }
                }

                for (i = 0; i < target.length; i++) {
                    if (processRender(stage, render, datas, defaultRenderParent, frame, formNode, renderParents, target[i]) === false) {
                        break;
                    }
                }
            } catch(e) {
                if (stage === STR_EXCEPT) {
                    // Exception in an exception, rethrow.
                    throw e;
                }

                datas = [e, stage, i, target[i]];
                processRender(STR_EXCEPT, render, datas, defaultRenderParent, frame, formNode, renderParents);
                emitEvent(STR_EXCEPT, frame, datas);
                ret = true;
            }
        } else if (target || target === NULL) {
            if (frame.isForm) {
                frame = frame[KEY_PARENT];
            }
            // null-value target could be used to remove previous render nodes.
            args = [frame._da || stage === STR_EXCEPT ? datas : datas[0], frame._p];
            if (formNode) { args.push(formNode); }

            if (isFunction(target)) {
                target = target.apply(frame, args);
                if (target === false || target === undefined) { return target; }
            }

            if (isInternalValue(1, target)) {
                // `target` is a $CR.$.uri() object.
                if (isFunction((i = target.u))) {
                    i = i.apply(frame, args);
                } else {
                    if (isFunction((n = target.p))) {
                        n = n.apply(frame, args);
                    }
                    i = makeURI(undefined, i, createParamsObject(n, frame._p));
                }
                API.set(i, target.r, target.e);
            } else if (target) {
                // `target` is a string, a DOM node, a function or a $CR.$.tpl() object.
                if (isNode(target)) { node = target; }

                i = isString(target) ? target : target.n;
                if (isFunction(i)) { node = i = i.apply(frame, args); }

                if (isString(i)) {
                    args.unshift(i);
                    node = callTemplateFunc.apply(frame, args);
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

                // `target` is a string or InternalValue(3).
                renderParent = getRenderParent(frame, target && target.p, defaultRenderParent);
                if (isString(renderParent)) { throwError(renderParent); }

                rememberedNodes = frame._n;
                mem = rememberedNodes[(renderParentId = renderParent._$Cid)];
                placeholder = mem[0];

                if (!((renderParentId in renderParents) || (target && (target.r === false)))) {
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


    function ProcessFrame(frame, refresh, formNode, formBody) {
        if (frame._l) {
            if (!frame._l.u) {
                return;
            }
            abortFrame(frame);
        }

        var skip = !refresh && ((frame._data !== undefined) || frame._l) && !frame[KEY_DATAERROR],
            self = this,
            datas = self.datas = [],
            dataSource = frame[KEY_DATASOURCE],
            i,
            d,
            waiting = 0,
            render = frame.render,
            resolve,
            done = function(index, data, /**/i, children, r, errors, prevDatas, stage) {
                if (index !== undefined) {
                    datas[index] = data;
                    waiting--;
                }

                if (!waiting && !self.rejected) {
                    errors = frame[KEY_DATAERROR];
                    children = frame.children;

                    if (!skip) {
                        // Ignore errors during background refresh.
                        if (refresh && errors) { frame[KEY_DATAERROR] = undefined; }

                        frame._l = undefined;
                        prevDatas = frame._data;
                        frame._data = datas;

                        stage = errors ? (refresh ? NULL : STR_ERROR) : STR_SUCCESS;

                        // Initially, when refresh argument is passed, it equals
                        // to 1. When some data is changed, it becomes 2 to
                        // skip equality check for child frames and rerender
                        // them anyway.
                        if (stage && refresh === 1) {
                            r = true;
                            for (i = datas.length; r && i--;) {
                                d = dataSource[i];
                                r = r && ((isInternalValue(4, d) && d.v.eq) || $H.eq).call(frame, datas[i], prevDatas[i]);
                            }
                            if (r) {
                                stage = NULL;
                            } else {
                                refresh = 2;
                            }
                        }

                        // Further stages might be delayed in case of `wait`
                        // setting of the frame. Store these stages execution
                        // in `frame._r`.
                        frame._r = function(/**/defaultRenderParent) {
                            frame._r = undefined;

                            defaultRenderParent = getRenderParent(frame, frame[KEY_RENDER_PARENT]);

                            if (stage) {
                                if (processRender(stage, render, errors || datas, defaultRenderParent, frame, formNode)) {
                                    return;
                                }

                                if (!refresh) {
                                    if (frame.isForm && (stage === STR_SUCCESS) && frame.tags) {
                                        API.refresh(frame.tags);
                                    }

                                    emitEvent(stage, frame, errors || datas);

                                    if (processRender(STR_AFTER, render, errors ? [true] : [], defaultRenderParent, frame, formNode)) {
                                        return;
                                    }
                                    emitEvent(STR_AFTER, frame);
                                }
                            }

                            if (((i = frame.refresh)) && (i.r !== undefined) && (prevDatas || !errors)) {
                                refreshFrame(frame, i.r, i);
                            }
                        };

                        if (frame.isForm) {
                            setFormState(frame[KEY_PARENT], frame, FORM_STATE_VALID);
                            frame._r();
                        }
                    }

                    // Update wait flags and call delayed callbacks if any.
                    callDelayedStages(currentRootFrame, frame, errors || (!frame.wait && !refresh) ? frame._w2 : 1);

                    for (i = 0; i < children.length; i++) {
                        r = children[i];
                        if (r._id in currentFrames) {
                            if (!errors) {
                                new ProcessFrame(r, refresh);
                            } else {
                                unprocessFrame(r, {});
                                removeNodes(oldDOM, 0);
                            }
                        }
                    }
                }
            };

        if (!skip) {
            frame._l = self;
            self.u = refresh;
            frame._w2 = d = frame._w;
            frame[KEY_DATAERROR] = undefined;

            if (!frame.wait && !refresh) {
                // Update wait flags and call delayed callbacks if any.
                callDelayedStages(currentRootFrame, frame, d);
            }

            i = ((i = (isFunction((i = frame.title)) ? i.call(frame, frame._p) : i))) === undefined
                ?
                defaultTitle
                :
                i;
            if (i !== undefined) {
                document.title = i;
            }

            if (!refresh) {
                if (processRender(STR_BEFORE, render, [], getRenderParent(frame, frame[KEY_RENDER_PARENT]), frame, formNode)) {
                    return;
                }
                emitEvent(STR_BEFORE, frame);
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
                    if (isInternalValue(2, d)) {
                        // Static data.
                        d = d.v;
                    } else {
                        if (isFunction(d)) {
                            d = d.call(frame, frame._p);
                        } else {
                            d = new AJAX(d, frame, formBody);
                            if ('o' in d) { d = d.o; }
                        }
                    }

                    datas.push(d);

                    if (d && isFunction(d.then)) {
                        resolve(i);
                    }
                }
            }
        }

        done();

        function callDelayedStages(frame, finished, finishedCount/**/, i) {
            // XXX: Probably optimize this somehow, to avoid traversing the tree
            //      from the root node.
            if (frame) {
                if (finishedCount) {
                    for (i = finished; i && i._w2; i = i[KEY_PARENT]) {
                        i._w2 -= finishedCount;
                    }
                }

                if (!frame._w2 && frame._r && (!((i = frame[KEY_PARENT])) || !i._r)) {
                    frame._r();
                }

                traverseFrame(frame, callDelayedStages, undefined, true);
            }
        }
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
        var i,
            nodesets,
            nodes;

        traverseFrame(frame, function(f) {
            unprocessFrame(f, activeFrames);
        }, undefined, true);

        // Cancel loading the data (if any).
        if ((i = frame._l)) {
            frame._r = !i.u;
            if (frame.isForm && !frame._c) {
                unprocessFrame(frame[KEY_PARENT], activeFrames, true);
            }
        }

        abortFrame(frame);

        if (frame._r) {
            // We've rejected the frame above and/or there were delayed stages.
            emitEvent('stop', frame);
        }

        // Reset the ready callback and the form existence flag if any.
        frame._r = frame._f = undefined;

        if (i !== undefined || frame._data !== undefined || Object.keys(frame._n).length) {
            frame._l = frame._data = frame[KEY_DATAERROR] = undefined;

            if (!(frame._id in activeFrames)) {
                emitEvent('leave', frame);

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

        if (!(frame._id in activeFrames)) {
            // Reuse `nodes` and `nodesets` variables.
            nodes = frame._p;
            nodesets = Object.keys(nodes);
            for (i = nodesets.length; i--;) {
                delete nodes[nodesets[i]];
            }
        }
    }


    function abortFrame(frame/**/, tmp) {
        // Reset auto refresh timer.
        if ((tmp = frame._u)) {
            clearTimeout(tmp);
            frame._u = undefined;
        }

        // Reset auto refresh timeout timer.
        if ((tmp = frame._o)) {
            clearTimeout(tmp);
            frame._o = undefined;
        }

        // Cancel loading the data (if any).
        if ((tmp = frame._l)) {
            tmp.reject();
            frame._l = undefined;
        }
    }


    function refreshFrame(frame, delay, settings, force, timeout/**/, r) {
        if (isFunction(delay)) { delay = delay.call(frame); }

        if (delay !== undefined && (!((r = frame._l)) || (r.u && force))) {
            abortFrame(frame);

            if (timeout && !settings.j) { delay -= timeout; }

            // Auto refresh timer.
            frame._u = setTimeout(function() {
                frame._u = NULL;
                abortFrame(frame);

                // Timeout.
                if ((timeout = settings.o || 0)) {
                    timeout = isFunction(timeout) ? timeout.call(frame) : timeout;
                    frame._o = setTimeout(function() {
                        frame._o = NULL;
                        refreshFrame(frame, settings.r, settings, false, timeout);
                    }, timeout);
                }

                new ProcessFrame(frame, 1);
            }, delay < 0 ? 0 : delay);
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
})(document, decodeURIComponent, encodeURIComponent, location, setTimeout, clearTimeout);
