describe('Form test', function() {
    it('runs form test', function() {
        var flag;
        var waitInit = function() {
            flag = false;
            setTimeout(function() { flag = true; }, 500);
        };
        var wait = function() {
            waitsFor(function() { return flag; });
        };

        var calls = [];
        var counter = 1;

        window.TEMPLATES = {
            Form1Parent: '<div>1<div class="form1">2</div>3</div>',
            Form1: '11<div>22<form>33<input type="text" name="hello" value="world">44<input type="submit" value="submit">55</form>66</div>77',
            Form1Result: function(name, args) { return JSON.stringify(args.slice(0, 2).concat([args[2].id, args[3] instanceof Node, args[3].tagName.toLowerCase()])); },
            Form2Parent: '<div>1<div class="form2">2</div>3</div>',
            Form2: '11<div>22<form id="fofo">33<input type="text" name="hello" value="world">|<input type="text" name="hi" value="all">44<input type="submit" value="submit">55</form>66</div>77',
            Form2Result: function(name, args) { return JSON.stringify(args.slice(0, 2).concat([args[2].id, args[3] instanceof Node, args[3].tagName.toLowerCase()])); }
        };

        $CR
            .add('/parent1', {
                render: 'Form1Parent',
                frames: {
                    '/form?p1=:p1': {
                        id: 'form1',
                        parent: '.form1',
                        render: 'Form1',
                        form: {
                            action: '/api/form1/:p1',
                            method: 'POST',
                            type: 'json',
                            render: 'Form1Result'
                        }
                    }
                }
            })
            .add('/parent2', {
                render: 'Form2Parent',
                frames: {
                    '/form?p2=:p2': {
                        id: 'form2',
                        parent: '.form2',
                        render: 'Form2',
                        form: {
                            action: {
                                uri: function(params) { return '/api/' + this.id + '/' + params.p2; },
                                parse: function(response, req) {
                                    return 'Form response: ' + this.id + ', ' + (typeof req.onreadystatechange) + ', ' + response;
                                },
                                transform: function(data, req) {
                                    return data + '|' + this.id + '|' + (typeof req.onreadystatechange);
                                }
                            },
                            method: 'post',
                            render: 'Form2Result',
                            submit: function(data, xhr, frame) {
                                return [
                                    {name: 'field1', value: this.id},
                                    {name: 'field2', value: JSON.stringify(data)},
                                    {name: 'field3', value: typeof xhr.onreadystatechange},
                                    {name: 'field4', value: frame.id}
                                ];
                            },
                            check: function(elem, val, data) {
                                calls.push(['check', this.id, elem instanceof Node, elem.name || '', val, data]);
                                return counter < 2 ? 'This is sadly an error' : false;
                            },
                            state: function(elem, state, msg) {
                                calls.push(['state', this.id, elem instanceof Node, elem.name || '', state, msg]);
                                elem.className = ((elem.name + elem.name) || '') + counter++;
                            }
                        }
                    }
                }
            })
            .run({callTemplate: testCallTemplate});

        $CR.set('/parent1/form?p1=ololo');
        expect(objectifyBody()).toEqual([
            {name: 'div', value: [
                '1',
                {name: 'div', value: [
                    '2',
                    '11',
                    {name: 'div', value: [
                        '22',
                        {name: 'form', value: [
                            '33',
                            {name: 'input', value: [], attr: {type: 'text', name: 'hello', value: 'world'}},
                            '44',
                            {name: 'input', value: [], attr: {type: 'submit', value: 'submit'}},
                            '55'
                        ]},
                        '66'
                    ]},
                    '77'
                ], attr: {class: 'form1'}},
                '3'
            ]}
        ]);

        var e = document.createEvent('HTMLEvents');
        e.initEvent('submit', true, true);
        document.forms[0].dispatchEvent(e);

        // The same but inputs are disabled.
        expect(objectifyBody()).toEqual([
            {name: 'div', value: [
                '1',
                {name: 'div', value: [
                    '2',
                    '11',
                    {name: 'div', value: [
                        '22',
                        {name: 'form', value: [
                            '33',
                            {name: 'input', value: [], attr: {type: 'text', name: 'hello', value: 'world', disabled: ''}},
                            '44',
                            {name: 'input', value: [], attr: {type: 'submit', value: 'submit', disabled: ''}},
                            '55'
                        ]},
                        '66'
                    ]},
                    '77'
                ], attr: {class: 'form1'}},
                '3'
            ]}
        ]);

        waitInit();
        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [
                        '2',
                        '[{"url":"/api/form1/ololo","method":"POST","body":"[{\\"name\\":\\"hello\\",\\"value\\":\\"world\\"}]"},{"p1":"ololo"},"form1",true,"form"]'
                    ], attr: {class: 'form1'}},
                    '3'
                ]}
            ]);

            $CR.set('/parent1/form?p1=ololo');

            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [
                        '2',
                        '11',
                        {name: 'div', value: [
                            '22',
                            {name: 'form', value: [
                                '33',
                                {name: 'input', value: [], attr: {type: 'text', name: 'hello', value: 'world'}},
                                '44',
                                {name: 'input', value: [], attr: {type: 'submit', value: 'submit'}},
                                '55'
                            ]},
                            '66'
                        ]},
                        '77'
                    ], attr: {class: 'form1'}},
                    '3'
                ]}
            ]);


            $CR.set('/parent2/form?p2=alala');

            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [
                        '2',
                        '11',
                        {name: 'div', value: [
                            '22',
                            {name: 'form', value: [
                                '33',
                                {name: 'input', value: [], attr: {type: 'text', name: 'hello', value: 'world'}},
                                '|',
                                {name: 'input', value: [], attr: {type: 'text', name: 'hi', value: 'all'}},
                                '44',
                                {name: 'input', value: [], attr: {type: 'submit', value: 'submit'}},
                                '55'
                            ], attr: {id: 'fofo'}},
                            '66'
                        ]},
                        '77'
                    ], attr: {class: 'form2'}},
                    '3'
                ]}
            ]);

            var e = document.createEvent('HTMLEvents');
            e.initEvent('submit', true, true);
            document.forms[0].dispatchEvent(e);

            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [
                        '2',
                        '11',
                        {name: 'div', value: [
                            '22',
                            {name: 'form', value: [
                                '33',
                                {name: 'input', value: [], attr: {type: 'text', name: 'hello', value: 'world', class: 'hellohello1'}},
                                '|',
                                {name: 'input', value: [], attr: {type: 'text', name: 'hi', value: 'all', class: 'hihi2'}},
                                '44',
                                {name: 'input', value: [], attr: {type: 'submit', value: 'submit', class: '3'}},
                                '55'
                            ], attr: {id: 'fofo'}},
                            '66'
                        ]},
                        '77'
                    ], attr: {class: 'form2'}},
                    '3'
                ]}
            ]);

            expect(calls).toEqual([
                ['check', 'form2', true, 'hello', 'world', [{name: 'hello', value: 'world'}, {name: 'hi', value: 'all'}]],
                ['state', 'form2', true, 'hello', 'invalid', 'This is sadly an error'],
                ['check', 'form2', true, 'hi', 'all', [{name: 'hello', value: 'world'}, {name: 'hi', value: 'all'}]],
                ['state', 'form2', true, 'hi', 'valid', false],
                ['check', 'form2', true, '', undefined, [{name: 'hello', value: 'world'}, {name: 'hi', value: 'all'}]],
                ['state', 'form2', true, '', 'valid', false]
            ]);
            calls = [];

            var e = document.createEvent('HTMLEvents');
            e.initEvent('submit', true, true);
            document.forms[0].dispatchEvent(e);

            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [
                        '2',
                        '11',
                        {name: 'div', value: [
                            '22',
                            {name: 'form', value: [
                                '33',
                                {name: 'input', value: [], attr: {type: 'text', name: 'hello', value: 'world', disabled: '', class: 'hellohello7'}},
                                '|',
                                {name: 'input', value: [], attr: {type: 'text', name: 'hi', value: 'all', disabled: '', class: 'hihi8'}},
                                '44',
                                {name: 'input', value: [], attr: {type: 'submit', value: 'submit', disabled: '', class: '9'}},
                                '55'
                            ], attr: {id: 'fofo'}},
                            '66'
                        ]},
                        '77'
                    ], attr: {class: 'form2'}},
                    '3'
                ]}
            ]);

            expect(calls).toEqual([
                ['check', 'form2', true, 'hello', 'world', [{name: 'hello', value: 'world'}, {name: 'hi', value: 'all'}]],
                ['state', 'form2', true, 'hello', 'valid', false],
                ['check', 'form2', true, 'hi', 'all', [{name: 'hello', value: 'world'}, {name: 'hi', value: 'all'}]],
                ['state', 'form2', true, 'hi', 'valid', false],
                ['check', 'form2', true, '', undefined, [{name: 'hello', value: 'world'}, {name: 'hi', value: 'all'}]],
                ['state', 'form2', true, '', 'valid', false],
                ['state', 'form2', true, 'hello', 'sending', undefined],
                ['state', 'form2', true, 'hi', 'sending', undefined],
                ['state', 'form2', true, '', 'sending', undefined]
            ]);
            calls = [];

            waitInit();
        });

        wait();

        runs(function() {
            expect(calls).toEqual([
                ['state', 'form2', true, 'hello', 'valid', undefined],
                ['state', 'form2', true, 'hi', 'valid', undefined],
                ['state', 'form2', true, '', 'valid', undefined]
            ]);
            calls = [];

            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [
                        '2',
                        '["Form response: form2, function, {\\"url\\":\\"/api/form2/alala\\",\\"method\\":\\"POST\\",\\"body\\":\\"field1=fofo&field2=%5B%7B%22name%22%3A%22hello%22%2C%22value%22%3A%22world%22%7D%2C%7B%22name%22%3A%22hi%22%2C%22value%22%3A%22all%22%7D%5D&field3=function&field4=form2\\"}|form2|function",{"p2":"alala"},"form2",true,"form"]'
                    ], attr: {class: 'form2'}},
                    '3'
                ]}
            ]);
        });
    });
});
