/*!
 * conkitty-route v0.12.0, https://github.com/hoho/conkitty-route
 * (c) 2014-2015 Marat Abdullin, MIT license
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
        currentLoading,
        currentRefreshing = {},
        currentPaused = {},
        currentPausedTags = {},

        reloadCurrent,

        frames = [],
        frameId = 0,

        frameById = {},

        notFoundFrame,

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

        FORM_STATE_VALID = 'valid',
        FORM_STATE_INVALID = 'invalid',
        FORM_STATE_SENDING = 'sending',

        STR_BEFORE = 'before',
        STR_SUCCESS = 'success',
        STR_ERROR = 'error',
        STR_AFTER = 'after',
        STR_EXCEPT = 'except',

        STR_SUBMIT = 'submit',

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

        API = function add(uri, frameSettings) {
            checkRunning();

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
        uri = createURLParsingAnchor(uri);
        if (!replace) { replace = location.href === uri.href; }
        return $H.go(uri.href, undefined, replace);
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
        defaultParent = defaults.parent || body;
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

        currentLoading = new LoadingRoot({
            before: function(loading, frame/**/, title, except) {
                title = ((title = (isFunction((title = frame.title)) ?
                    title.call(frame, frame._p)
                    :
                    title))) === undefined ?
                    defaultTitle
                    :
                    title;

                if (title !== undefined) {
                    document.title = title;
                }

                emitEvent(STR_BEFORE, frame);

                if ((except = processRender(STR_BEFORE, [], frame, loading.form))) {
                    emitEvent(STR_EXCEPT, frame, except);
                    processRender(STR_EXCEPT, except, frame, loading.form);
                    loading.remove();
                }
            },

            stop: function(loading, frame) {
                emitEvent('stop', frame);
            },

            success: function(loading, frame/**/, except) {
                if ((except = processRender(STR_SUCCESS, loading.loaded, frame, loading.form, loading.isArray))) {
                    emitEvent(STR_EXCEPT, frame, except);
                    processRender(STR_EXCEPT, except, frame, loading.form);
                    loading.remove();
                } else {
                    emitEvent(STR_SUCCESS, frame, loading.loaded);

                    if ((except = processRender(STR_AFTER, [], frame, loading.form))) {
                        emitEvent(STR_EXCEPT, frame, except);
                        processRender(STR_EXCEPT, except, frame, loading.form);
                        loading.remove();
                    } else {
                        emitEvent(STR_AFTER, frame);
                    }
                }

                if (frame.isForm) {
                    setFormState(frame.parent, frame, FORM_STATE_VALID);
                }

                if (frame.isForm && frame.tags) {
                    API.refresh(Object.keys(frame.tags).join(' '));
                }
            },

            error: function(loading, frame/**/, except) {
                if ((except = processRender(STR_ERROR, loading.errors, frame, loading.form, loading.isArray))) {
                    emitEvent(STR_EXCEPT, frame, except);
                    processRender(STR_EXCEPT, except, frame, loading.form);
                    loading.remove();
                } else {
                    emitEvent(STR_ERROR, frame, loading.errors);

                    if ((except = processRender(STR_AFTER, [true], frame, loading.form))) {
                        emitEvent(STR_EXCEPT, frame, except);
                        processRender(STR_EXCEPT, except, frame, loading.form);
                        loading.remove();
                    } else {
                        emitEvent(STR_AFTER, frame);
                    }
                }

                if (frame.isForm) {
                    setFormState(frame.parent, frame, FORM_STATE_VALID);
                }
            },

            load: function(loading, frame) {
                cancelRefresh(frame._id);
            },

            ready: function(loading, frame/**/, refresh) {
                if (((refresh = frame._refresh)) && refresh.r) {
                    refreshFrame(frame, refresh);
                }
            },

            data: function(loading, frame) {
                frame._data = loading.loaded;
            },

            remove: function(loading, frame/**/, nodesets, keepPlaceholders, i) {
                cancelRefresh(frame._id);

                nodesets = frame._n;

                keepPlaceholders = keepPlaceholders ? 1 : 0;

                for (i in nodesets) {
                    var nodes = nodesets[i];
                    while (nodes.length > keepPlaceholders) {
                        frame._d.push(nodes.pop());
                    }
                }

                if (!keepPlaceholders) {
                    frame._n = {};
                }
            }
        });

        $H.on(undefined, function() {
            var newRootFrame,
                newFrames = {},
                i,
                j,
                frame,
                haveNewFrames,
                newFramesCount = 0,
                currentFramesCount = 0,
                newPaused = {},
                newPausedTags = {},
                tmp,
                oldPausedTags,
                activateParallelFramesCallback = function(f/**/, parallel, k, s) {
                    // Check if there are parallel frames.
                    if ((parallel = f._g)) {
                        for (k = parallel.length; k--; ) {
                            // Check if at least one active frame among the
                            // arallel frames exists.
                            if (((s = parallel[k]))._a) {
                                s = s._s;
                                for (k = parallel.length; k--; ) {
                                    // Activate the inactive parallel frames.
                                    if (!((f = parallel[k]))._a && (f.final !== false)) {
                                        setFrameActiveFlag(f, 1);
                                    }
                                    f._s = s;
                                }
                                break;
                            }
                        }
                    }
                },
                traverseCallback = function(f/**/, tmp2, brk) {
                    if (f._a) {
                        newFrames[(tmp2 = f._id)] = f;
                        newFramesCount++;

                        if (!haveNewFrames && !(tmp2 in currentFrames)) {
                            haveNewFrames = true;
                        }

                        if (isFunction((brk = f.break))) {
                            brk = brk.call(f);
                        }

                        if (((tmp2 = f._refresh)) && ((tmp2 = tmp2.p))) {
                            for (j in tmp2) {
                                newPausedTags[j] = true;
                            }
                        }

                        return !!brk;
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
                    traverseFrame(newRootFrame, undefined, traverseCallback);
                    break;
                }
            }

            for (i in currentFrames) {
                currentFramesCount++;
                frame = currentFrames[i];

                if (frame.isNamed && (frame.parent._id in newFrames)) {
                    newFrames[i] = frame;
                }

                i = i in newFrames;

                if (i) {
                    j = currentLoading[frame._id];

                    if (j &&
                        (reloadCurrent ||
                         j.errors ||
                         (!frame._s && !frame.isNamed) ||
                         frame.keep === false))
                    {
                        j.remove();
                    }

                    // A flag for frame.active(true) to show that this frame
                    // is not just active, but was active in previous location
                    // too.
                    frame._s = 1;
                } else {
                    emitEvent('leave', frame);

                    frame._data = undefined;

                    // The frame is no longer active, remove parameters.
                    var params = frame._p;
                    var keys = Object.keys(params);
                    for (i = keys.length; i--; ) {
                        delete params[keys[i]];
                    }
                }
            }

            for (i in newPausedTags) {
                for (j in newFrames) {
                    frame = newFrames[j];
                    if (((tmp = frame.tags)) && (i in tmp)) {
                        cancelRefresh(j);
                        newPaused[j] = frame;
                    }
                }
            }

            currentFrames = newFrames;
            reloadCurrent = undefined;
            currentRootFrame = newRootFrame;

            oldPausedTags = currentPausedTags;
            currentPausedTags = newPausedTags;
            currentPaused = newPaused;

            for (i in oldPausedTags) {
                if (!(i in newPausedTags)) {
                    for (j in newFrames) {
                        frame = newFrames[j];
                        if (((tmp = frame.tags)) && (i in tmp) && ((tmp = frame._refresh)) && tmp.r) {
                            refreshFrame(frame, tmp);
                        }
                    }
                }
            }

            currentLoading.mount(newRootFrame);

            if (!haveNewFrames && (newFramesCount < currentFramesCount)) {
                removeOldNodes();
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

        addEvent('click', function(e/**/, replace) {
            var elem = e.target;
            while (elem && !(elem instanceof HTMLAnchorElement)) {
                elem = elem.parentNode;
            }
            if (elem &&
                (!((replace = elem.target)) || ((replace = replace === '$CR.replace'))) &&
                (elem.host === location.host) &&
                !(e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.which !== 1)))
            {
                e.preventDefault();
                API.set(elem.href, undefined, replace);
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
                data = createURLParsingAnchor(formNode.action);
                if (data.host === location.host) {
                    e.preventDefault();
                    action = data.pathname + data.search;
                    // IE doesn't supply <a> tag pathname with leading slash.
                    API.set((action[0] === '/' ? action : ('/' + action)) + (data.search ? '&' : '?') + formToQuerystring(serializeForm(formNode)));
                }
            }

            function submitForm(formData) {
                action = isFunction((action = formNode.getAttribute('action') || form.action)) ?
                    action.call(formNode, formData, frame)
                    :
                    (action || location.href);

                type = form.type || 'qs';

                if (form.method === 'get' && type === 'qs') {
                    if (formData.length) {
                        action += (~action.indexOf('?') ? '&' : '?') + formToQuerystring(formData);
                    }
                    formData = undefined;
                }

                if (type === 'qs' && (!formData || !formData.length)) {
                    formData = type = undefined;
                }

                form[KEY_DATASOURCE] = [false, [action]];

                currentLoading[frame._id].submit(
                    form,
                    formNode,
                    function(xhr/**/, xhrCallback) {
                        if (formData !== undefined || type !== undefined) {
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
                            xhrCallback.call(formNode, xhr, formData, frame);
                        }

                        setFormState(frame, form, FORM_STATE_SENDING);

                        return type === 'json' ?
                            JSON.stringify(formData)
                            :
                            (formData ?
                                (type === 'text' ?
                                    formData + ''
                                    :
                                    formToQuerystring(formData || []))
                                :
                                undefined);
                    }
                );
            }
        });

        running = true;
        $H.run();

        // Exposing debug information.
        API._debug = {f: frames};
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


    function traverseFrame(frame, callbackBefore, callback, childrenOnly, withNamed/**/, i, children, f, ret) {
        if (!childrenOnly && callbackBefore) {
            callbackBefore(frame);
        }

        children = frame.children.slice(0);

        if (withNamed) {
            f = frame.namedChildren;
            for (i in f) {
                children.push(f[i]);
            }
        }

        for (i = 0; i < children.length; i++) {
            ret = traverseFrame((f = children[i]), callbackBefore, callback, undefined, withNamed);
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
                for (i = event.length; i--; ) {
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
                    for (i = currentHandlers.length; i--; ) {
                        if (currentHandlers[i] === handler) {
                            currentHandlers.splice(i, 1);
                        }
                    }
                }
            } else {
                for (i = event.length; i--; ) {
                    API.on(event[i], handler, frame);
                }
            }
        }
        return API;
    };


    API.get = function get(id, name) {
        var ret = frameById[id];
        return name ? ret && ret.get(name) : ret;
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
            var ret = new InternalValue(5), // Magic number 5: Automatic background refresh timeout.
                tmp,
                i,
                p;

            if (isFunction(settings) || (typeof settings === 'number')) {
                settings = {refresh: settings};
            }

            if (settings) {
                ret.r = settings.refresh;
                ret.o = settings.timeout;
                ret.a = settings.retry;

                if ((tmp = settings.pause)) {
                    tmp = tmp.split(whitespace);
                    ret.p = p = {};
                    for (i = tmp.length; i--; ) {
                        p[tmp[i]] = true;
                    }
                }
            }

            if (!ret.r && !ret.o && !ret.p) {
                throwError('Wrong refresh');
            }

            return ret;
        }
    };


    API.refresh = function refresh(tags) {
        tags = tags.split(whitespace);
        traverseFrame(currentRootFrame, undefined, function(frame/**/, settings, frameTags, i) {
            if ((frame._id in currentFrames) && !frame.isForm && ((frameTags = frame.tags))) {
                settings = frame._refresh || {};
                for (i = tags.length; i--; ) {
                    if (tags[i] in frameTags) {
                        refreshFrame(frame, {o: settings.o}, 0);
                        break;
                    }
                }
            }
        });
    };


    proto.reload = function() {
        var self = this,
            loading = currentLoading[self._id];

        if (loading) {
            loading.remove();
            currentLoading.mount(currentRootFrame);
        }
    };


    proto.refresh = function(data) {
        refreshFrame(this, {}, 0, data === undefined ? undefined : adjustData(data));
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


    proto.get = function(name) {
        return this.namedChildren[name];
    };
    proto.activate = function(params) {
        activateNamedFrame(true, this, params);
    };
    proto.deactivate = function() {
        activateNamedFrame(false, this);
    };
    function activateNamedFrame(activate, namedFrame, params) {
        if (namedFrame) {
            var active,
                currentParams,
                oldParamNames,
                oldParams,
                tmp,
                i,
                parent = namedFrame.parent,
                id = namedFrame._id;

            if (activate && !parent.active()) {
                throwError('Parent is not active');
            }

            active = id in currentFrames;
            currentParams = namedFrame._p;

            oldParams = {};
            oldParamNames = Object.keys(currentParams);
            for (i = oldParamNames.length; i--; ) {
                tmp = oldParamNames[i];
                oldParams[tmp] = currentParams[tmp];
            }

            tmp = !$H.eq(oldParams, params || {});

            if ((!activate && active) || tmp) {
                delete currentFrames[id];

                if ((i = currentLoading[id])) {
                    i.remove();
                }

                if (!activate && active) {
                    removeOldNodes(namedFrame);
                }

                for (i = oldParamNames.length; i--; ) {
                    delete currentParams[oldParamNames[i]];
                }
            }

            if (activate && (!active || tmp)) {
                currentFrames[id] = namedFrame;
                if (params) {
                    for (tmp in params) {
                        currentParams[tmp] = params[tmp];
                    }
                }

                tmp = currentLoading[parent._id];
                tmp = new LoadingFrame(namedFrame, tmp, currentLoading, true);
                tmp.load();
            }
        }
    }


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
                for (i = frames.length; i--; ) {
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


    function addFrame(uri, frameSettings) {
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
            frame = frame.isForm ? frame.parent : frame;

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
                ok = (((value = constraint.call(frame, newParams, value))) !== undefined) || expected.optional;
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


    function setFrameActiveFlag(frame, active, noTraverse/**/, a) {
        // frame._a means active frame.
        if (!active && !noTraverse) {
            // Deactivate children, if any.
            traverseFrame(frame, undefined, function(f) {
                if (f._a) {
                    setFrameActiveFlag(f, active, true);
                }
            }, true);
        }
        if (!!((a = frame._a)) === !active) {
            while (frame) {
                // Tell parents about it.
                frame._a += (active || -a);
                frame = frame.parent;
            }
        }
    }


    function Frame(container, parallel, uri, frameSettings, pathExpr, paramsOffset, parent, form, named) {
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

        self.parent = parent;
        self.root = parent ? (parent.root || parent) : self;
        self.children = [];
        self.namedChildren = {};
        self.uri = uri;
        self._id = 'r' + (++frameId);
        self._n = {};
        self._d = [];

        if (frameSettings) {
            self.title = frameSettings.title || (parent && parent.title);
            self[KEY_RENDER_PARENT] = frameSettings.parent || (parent && parent[KEY_RENDER_PARENT]);
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
                if (named) {
                    self.isNamed = true;
                    container[uri] = self;
                    uri = undefined;
                } else {
                    container.push(self);
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
                    self.final = frameSettings.final;
                    self.partial = frameSettings.partial;
                    self.reduce = frameSettings.reduce;
                    self.wait = ((i = frameSettings.wait) === undefined ? parent && parent.wait : i) || false;
                }

                self.keep = frameSettings.keep;

                self[KEY_DATASOURCE] = adjustData(frameSettings.data);

                self.form = frameSettings.form;

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

                if ((tmp = frameSettings.refresh)) {
                    self._refresh = isInternalValue(5, tmp) ? tmp : API.$.refresh(tmp);
                }
            }

            if (((tmp = frameSettings.tags)) || ((i = self.id))) {
                self.tags = f = {};

                if (i) {
                    f[i] = true;
                }

                if (tmp) {
                    tmp = tmp.split(whitespace);
                    for (i = tmp.length; i--; ) {
                        f[tmp[i]] = true;
                    }
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

            if ((childFrames = frameSettings && frameSettings.named)) {
                for (f in childFrames) {
                    new Frame(
                        self.namedChildren,
                        undefined,
                        f,
                        childFrames[f], // frameSettings
                        undefined,
                        undefined,
                        self, // parent
                        undefined, // form
                        true
                    );
                }
            }
        }

        if (!form && !named) {
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

        if (!named) {
            self.activate = self.deactivate = undefined;
        }


        function finishMatching(/**/matcher, name, val, k) {
            val = Object.keys(currentParams);
            for (k = val.length; k--; ) {
                name = val[k];
                if (!newParams.hasOwnProperty(name)) {
                    delete currentParams[name];
                }
            }

            // Calculable parameters.
            for (name in paramsConstraints) {
                if (!(name in processedParams)) {
                    val = paramsConstraints[name];
                    if (((val = isFunction(val) ? val.call(self, currentParams) : val)) !== undefined) {
                        currentParams[name] = val;
                    }
                }
            }

            // Run custom matcher if any.
            return (matcher = frameSettings.matcher) ? matcher.call(self, currentParams) : true;
        }
    }


    function adjustData(data/**/, ret, sources, i) {
        // ret[0] indicates that it is an Array originally.
        i = isArray(data);
        ret = [
            i,
            (sources = (data === undefined ? [] : (i ? data : [data])))
        ];

        for (i = 0; i < sources.length; i++) {
            checkDataSource(sources[i]);
        }

        return ret;
    }


    function checkDataSource(ds) {
        if (!ds || !(isInternalValue(2, ds) || isInternalValue(4, ds) || isString(ds) || isFunction(ds))) {
            throwError('Unexpected `' + ds + '` as data source');
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

        for (i = RENDER_KEYS.length; i--; ) {
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


    function createURLParsingAnchor(href/**/, a) {
        a = document.createElement('a');
        a.href = href;
        // The next line is yet one more hello to Internet Explorer which
        // doesn't populate a.protocol and a.host without this line.
        a.href = a.href;
        return a;
    }


    function makeURI(frame, uri, overrideParams, pathname, queryparams, processedQueryparams, hash, child, origin) {
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

        if (!child) {
            i = createURLParsingAnchor(uri);
            if ((origin = i.protocol !== location.protocol || i.host !== location.host ? i.protocol + '//' + i.host : '')) {
                uri = i.pathname + i.search;
                if (((j = i.hash)) && j.length > 1) { uri += j; }
            }
        }

        if (!frame || (frame && frame.reduce !== false)) {
            uri = parseParameterizedURI(uri, true, !overrideParams);

            pathObj = uri.pathname[0];

            for (i = pathObj.length; i--; ) {
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

        if (overrideParams && frame && ((i = frame.parent))) {
            // Building frame URI from frames tree, current state and params to override.
            makeURI(i, i.uri, overrideParams, pathname, queryparams, processedQueryparams, hash, true, origin);
        }

        if (!child) {
            // Skip this part for recursive call.
            pathname = origin + ('/' + pathname.join('/')).replace(/\/+/g, '/');

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
        frame = frame.isForm ? frame.parent : frame;

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
                    } catch(e) {
                        // Empty.
                    }
                }
                self.done();
                self.r = undefined;
            }
        };

        if (body) {
            body = body(req);
        }

        // When there is an argument, Internet Explorer converts it to
        // string and sends anyway (even if the argument has undefined
        // value).
        if (body !== undefined) {
            req.send(body);
        } else {
            req.send();
        }
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
        frame = frame.isForm ? frame.parent : frame;
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


    function processRender(stage, datas, frame, formNode, dataSourceIsArray, renderParents, target) {
        var i,
            mem,
            node,
            parent,
            renderParent,
            renderParentId,
            defaultRenderParent = getRenderParent(frame, frame[KEY_RENDER_PARENT]),
            render = frame.render,
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
                    if (processRender(stage, datas, frame, formNode, dataSourceIsArray, renderParents, target[i]) === false) {
                        break;
                    }
                }
            } catch(e) {
                if (stage === STR_EXCEPT) {
                    // Exception in an exception, rethrow.
                    throw e;
                }

                ret = [e, stage, i, target[i]];
            }
        } else if (target || target === NULL) {
            if (frame.isForm) {
                frame = frame.parent;
            }
            // null-value target could be used to remove previous render nodes.
            args = [dataSourceIsArray || stage === STR_EXCEPT ? datas : datas[0], frame._p];
            if (formNode) {
                args.push(formNode);
            }

            if (isFunction(target)) {
                target = target.apply(frame, args);
                if (target === false || target === undefined) {
                    return target;
                }
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

                if (isFunction(i)) {
                    node = i = i.apply(frame, args);
                }

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

                if (node === false) {
                    return node;
                }
            }

            if (!target || isNode(node)) {
                // Remove nodes from previous frames if any.
                removeOldNodes();

                // `target` is a string or InternalValue(3).
                renderParent = getRenderParent(frame, target && target.p, defaultRenderParent);
                if (isString(renderParent)) {
                    throwError(renderParent);
                }

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
                            frame._d = frame._d.concat(i.splice(1, i.length - 1));
                            removeOldNodes();
                        }
                    }
                }

                renderParents[renderParentId] = renderParents._ = true;

                if (target) {
                    if ((parent = placeholder.parentNode)) {
                        n = placeholder.previousSibling;
                        parent.insertBefore(node, placeholder);
                        // Remember frame's inserted nodes.
                        for (i = n ? n[KEY_NEXT_SIBLING] : parent.firstChild;
                             i !== placeholder;
                             i = i[KEY_NEXT_SIBLING])
                        {
                            mem.push(i);
                            i[KEY_FRAME] = frame;
                        }
                    }
                }
            }
        }

        return ret;
    }


    function removeOldNodes(frame/**/, i) {
        if (frame) {
            traverseFrame(frame, function(f/**/, nodes, parent, node) {
                nodes = f._d;
                while ((node = nodes.pop())) {
                    if ((parent = node.parentNode)) {
                        parent.removeChild(node);
                    }
                }
            }, undefined, undefined, true/* withNamed*/);
        } else {
            for (i = frames.length; i--; ) {
                removeOldNodes(frames[i]);
            }
        }
    }


    function LoadingRoot(handlers, forceWait, frame, overrideData) {
        this.handlers = handlers;
        this.wait = forceWait;
        if (frame) { this.mount(frame, overrideData); }
    }


    proto = LoadingRoot.prototype;

    // LoadingRoot.prototype.mount().
    proto.mount = function(frame, overrideData) {
        var self = this,
            loading = self.loading;

        if (loading && (self.frame === frame)) {
            loading.reconcile();
        } else {
            self.frame = frame;

            if (loading) {
                loading.remove();
            }

            self.loading = loading = (frame ?
                new LoadingFrame(frame, undefined, self)
                :
                undefined);
        }

        if (loading) { loading.load(overrideData); }
    };


    // LoadingRoot.prototype.unmount().
    proto.unmount = function() {
        if (this.loading) { this.loading.remove(); }
    };


    function LoadingFrame(frame, parent, root, noReconcile) {
        var self = this;

        self.parent = parent;
        self.frame = frame;
        self.children = {};
        self.root = root;
        self.count = 0;
        self.waiting = 0;

        self.counters(1);

        root[frame._id] = self;
        if (parent) { parent.children[frame._id] = self; }

        if (!noReconcile) {
            self.reconcile();
        }
    }


    proto = LoadingFrame.prototype;


    // LoadingFrame.prototype.emit().
    proto.emit = function(name) {
        var handler = this.root.handlers[name];
        if (handler) {
            handler(this, this.frame);
        }
    };


    // LoadingFrame.prototype.reconcile().
    proto.reconcile = function() {
        var self = this,
            frame = self.frame,
            children,
            ids,
            i,
            frameChildren,
            id;

        if (frame._id in currentFrames) {
            children = self.children;
            ids = Object.keys(children);

            for (i = 0; i < ids.length; i++) {
                children[ids[i]].reconcile();
            }

            frameChildren = frame.children;
            for (i = 0; i < frameChildren.length; i++) {
                frame = frameChildren[i];
                id = frame._id;
                if ((id in currentFrames) && !(id in children)) {
                    new LoadingFrame(frame, self, self.root);
                }
            }
        } else if (!(frame.isForm && (self.parent.frame._id in currentFrames))) {
            self.remove();
        }
    };


    // LoadingFrame.prototype.load().
    proto.load = function(overrideData) {
        var self = this,
            frame = self.frame,
            src = overrideData || frame[KEY_DATASOURCE],
            i,
            d,
            waitingCount = 1,
            loading,
            errors;

        if (self.loaded) {
            self.loadChildren();
        }

        if (self.loading || self.loaded) {
            return;
        }

        for (i = self; i; i = i.parent) {
            i.emit('load');
        }

        self.emit(STR_BEFORE);

        loading = self.loading = [];
        self.errors = undefined;

        self.isArray = src[0];
        src = src[1];

        for (i = 0; i < src.length; i++) {
            if ((d = src[i])) {
                if (isInternalValue(2, d)) {
                    // Static data.
                    d = d.v;
                } else {
                    if (isFunction(d)) {
                        d = d.call(frame, frame._p);
                    } else {
                        d = new AJAX(d, frame, self.body);
                        if ('o' in d) { d = d.o; }
                    }
                }

                waitingCount++;

                loading.push(d);

                if (d && isFunction(d.then)) {
                    wait(i);
                } else {
                    done();
                }
            }
        }

        done();

        function wait(index) {
            d.then(function(data) {
                loading[index] = data;
                done();
            }, function(xhr) {
                if (!errors) {
                    self.errors = errors = new Array(loading.length);
                }
                errors[index] = xhr;
                done();
            });
        }

        function done() {
            waitingCount--;

            if (!waitingCount && !self.aborted) {
                self.loading = undefined;

                self.counters(-1);

                if (errors) {
                    self.remove(true);
                } else {
                    self.loaded = loading;
                    self.emit('data');
                }

                i = self.root;

                d = [];

                traverseLoading(i.loading, function(l) {
                    if (!l.done &&
                        !l.loading &&
                        (l.loaded || l.errors) &&
                        (!l.parent || l.parent.done) &&
                        (!l.waiting || !(l.frame.wait || i.wait)))
                    {
                        l.done = true;
                        l.emit(l.errors ? STR_ERROR : STR_SUCCESS);
                    }

                    if (l.done && !l.count) {
                        d.push(l);
                    }
                });

                while ((i = d.shift())) {
                    i.emit('ready');
                }

                if (!errors) {
                    self.loadChildren();
                }
            }
        }
    };


    function traverseLoading(loading, callback/**/, children, keys, i) {
        if (loading) {
            callback(loading);

            children = loading.children;
            keys = Object.keys(children);

            for (i = 0; i < keys.length; i++) {
                traverseLoading(children[keys[i]], callback);
            }
        }
    }


    // LoadingFrame.prototype.submit().
    proto.submit = function(formFrame, formNode, formBody) {
        var self = this,
            loading = new LoadingFrame(formFrame, self, self.root, true);

        loading.form = formNode;
        loading.body = formBody;

        loading.load();
    };


    // LoadingFrame.prototype.loadChildren().
    proto.loadChildren = function() {
        if (this.loaded) {
            var children = this.children,
                i;

            for (i in children) {
                children[i].load();
            }
        }
    };


    // LoadingFrame.prototype.remove().
    proto.remove = function(childrenOnly/**/, self, ids, i, root) {
        self = this;
        root = self.root;
        ids = Object.keys(self.children);

        for (i = ids.length; i--; ) {
            self.children[ids[i]].remove();
        }

        if (!childrenOnly) {
            self.abort();

            if (self.parent) {
                delete self.parent.children[self.frame._id];
            } else {
                root.loading = undefined;
            }

            delete root[self.frame._id];
            self.emit('remove');
        }
    };


    // LoadingFrame.prototype.abort().
    proto.abort = function() {
        var self = this,
            loading = self.loading,
            i,
            tmp;

        self.aborted = true;

        if (loading) {
            for (i = loading.length; i--; ) {
                tmp = loading[i];
                if (isFunction(tmp.abort)) { tmp.abort(); }
                if (isFunction(tmp.reject)) { tmp.reject(); }
            }

            self.counters(-1);
        }

        if (!self.done) {
            self.emit('stop');
        }

        self.loading = self.loaded = self.errors = undefined;
    };


    proto.counters = function(val/**/, forceWait, i, waitBreak) {
        forceWait = this.root.wait;
        for (i = this; i; i = i.parent) {
            i.count += val;
            if (!i.frame.wait && !forceWait) { waitBreak = true; }
            if (!waitBreak) { i.waiting += val; }
        }
    };


    function refreshFrame(frame, settings, delay, overrideData) {
        var error,
            refreshing,
            cur = [],
            timeout,
            id = frame._id,
            renderQueue = [];

        if (delay === undefined) {
            delay = settings.r;
        }

        if (isFunction(delay)) { delay = delay.call(frame); }
        delay = +delay;

        if (!(id in currentLoading) ||
            currentLoading[id].count ||
            (id in currentPaused))
        {
            return;
        }

        cancelRefresh(frame._id);

        currentRefreshing[id] = cur;

        cur[0] = setTimeout(function() {
            if (currentRefreshing[id] !== cur) {
                return;
            }

            cur[0] = undefined;

            timeout = settings.o;
            if (isFunction(timeout)) { timeout = timeout.call(frame); }
            timeout = +timeout;

            if (!isNaN(timeout) && timeout > 0) {
                cur[1] = setTimeout(function(/**/retry) {
                    cur[1] = undefined;

                    if (currentRefreshing[id] === cur) {
                        retry = settings.a;
                        if (retry === undefined) { retry = settings.r; }

                        if (retry !== undefined) {
                            refreshFrame(frame, settings, retry, overrideData);
                        }
                    }
                }, timeout);
            }

            cur[2] = new LoadingRoot({
                success: function(loading, readyFrame) {
                    if (error || (currentRefreshing[id] !== cur)) {
                        return;
                    }

                    var data = loading.loaded,
                        curData = readyFrame._data,
                        equal = true,
                        i,
                        tmp;

                    if (curData || refreshing) {
                        if (refreshing) {
                            equal = false;
                        } else {
                            for (i = data.length; equal && i--; ) {
                                tmp = readyFrame[KEY_DATASOURCE][1][i];
                                equal = equal && ((isInternalValue(4, tmp) && tmp.v.eq) || $H.eq).call(readyFrame, data[i], curData[i]);
                            }
                        }

                        if (!equal) {
                            refreshing = true;
                            renderQueue.push([loading, readyFrame]);
                        }
                    }
                },

                ready: function(loading, readyFrame/**/, item, l, f, except) {
                    if (readyFrame._id === id &&
                        currentRefreshing[id] === cur &&
                        !error)
                    {
                        while ((item = renderQueue.shift())) {
                            l = item[0];
                            f = item[1];

                            if ((except = processRender(STR_SUCCESS, (f._data = l.loaded), f, undefined, l.isArray))) {
                                emitEvent(STR_EXCEPT, f, except);
                                processRender(STR_EXCEPT, except, f);
                                l.remove();
                                return;
                            }
                        }

                        if (((f = frame._refresh)) && f.r) {
                            refreshFrame(frame, f);
                        }
                    }
                },

                error: function() {
                    if (!error) {
                        error = true;
                        refreshFrame(frame, settings, delay, overrideData);
                    }
                }
            }, true, frame, overrideData);
        }, isNaN(delay) || delay < 0 ? 0 : delay);
    }


    function cancelRefresh(id/**/, cur) {
        if ((cur = currentRefreshing[id])) {
            if (cur[0]) { clearTimeout(cur[0]); }
            if (cur[1]) { clearTimeout(cur[1]); }
            if (cur[2]) { cur[2].unmount(); }
            delete currentRefreshing[id];
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
