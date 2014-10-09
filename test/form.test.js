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

        window.TEMPLATES = {
            Form1Parent: '<div>1<div class="form1">2</div>3</div>',
            Form1: '11<div>22<form>33<input type="text" name="hello" value="world">44<input type="submit">55</form>66</div>77',
            Form1Result: function(name, args) { return JSON.stringify(args.slice(0, 2)); }
        };

        $CR
            .add('/parent1', {
                render: 'Form1Parent',
                frames: {
                    '/form?p1=:p1': {
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
                            {name: 'input', value: [], attr: {type: 'submit'}},
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
                            {name: 'input', value: [], attr: {type: 'submit', disabled: ''}},
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
                        '[{"url":"/api/form1/ololo","method":"POST","body":"[{\\"name\\":\\"hello\\",\\"value\\":\\"world\\"}]"},null]'
                    ], attr: {class: 'form1'}},
                    '3'
                ]}            ]);

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
                                {name: 'input', value: [], attr: {type: 'submit'}},
                                '55'
                            ]},
                            '66'
                        ]},
                        '77'
                    ], attr: {class: 'form1'}},
                    '3'
                ]}
            ]);
        });
    });
});
