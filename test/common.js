if (!window.Promise) {
    // Mock required by tests subset of native Promise in case it is not
    // present.
    (function() {
        var Promise = function(cb) {
            cb(this.resolve.bind(this), this.reject.bind(this));
            this.ok = [];
            this.err = [];
        };
        window.Promise = Promise;

        Promise.prototype.resolve = function(data) {
            var cb;
            while (cb = this.ok.shift()) { cb(data); }
        };

        Promise.prototype.reject = function(data) {
            var cb;
            while (cb = this.err.shift()) { cb(data); }
        };

        Promise.prototype.then = function(ok, err) {
            if (ok) { this.ok.push(ok); }
            if (err) { this.err.push(err); }
        };
    })();
}


// Convert document.body content to object that could be assert functions.
function objectifyBody() {
    return _objectifyBody(document.body);
}


function _objectifyBody(root) {
    var name,
        val,
        ret = [];

    for (var cur = root && root.firstChild; cur; cur = cur.nextSibling) {
        switch (cur.nodeType) {
            case 1:
                name = cur.nodeName.toLowerCase();
                if (name !== 'script') {
                    val = {
                        name: name,
                        value: _objectifyBody(cur)
                    };

                    if (cur.attributes.length) {
                        var attr = {},
                            a;
                        for (var i = 0; i < cur.attributes.length; i++) {
                            a = cur.attributes[i];
                            attr[a.name] = a.value;
                        }
                        val.attr = attr;
                    }

                    ret.push(val);
                }
                break;
            case 3:
                val = cur.nodeValue.trim();
                if (val) {
                    ret.push(val);
                }
                break;
        }
    }

    return ret;
}


function HTML2DOM(code) {
    var tmp = document.createElement('div'),
        cur;

    tmp.innerHTML = code;
    cur = tmp.firstChild;

    if (cur && !cur.nextSibling) {
        cur = tmp.removeChild(cur);
        return cur;
    }

    var ret = document.createDocumentFragment();

    while (cur) {
        tmp = cur.nextSibling;
        ret.appendChild(cur);
        cur = tmp;
    }

    return ret;
}


window.TEMPLATES = {};


function testCallTemplate(name, data, params, formNode) {
    var tpl;
    if (tpl = window.TEMPLATES[name]) {
        if (typeof tpl === 'function') { tpl = tpl.call(this, name, data, params, formNode); }
    } else {
        tpl = '<div>' + name + '</div><p>' + location.pathname + '</p>';
    }
    return Math.random() > 0.5 ? HTML2DOM(tpl) : tpl;
}


// Other tests will be injected from gulpfile.js.
describe('Empty test', function() {
    it('should be ok', function() {
        expect(true).toBe(true);
    });
});


function flattenParams(params) {
    var ret = {};
    for (var p in params) {
        ret[p] = params[p];
    }
    return ret;
}
