describe('Named frames test', function() {
    it('runs named frames test', function() {
        var flag;
        var waitInit = function() {
            flag = false;
            setTimeout(function() { flag = true; }, 500);
        };
        var wait = function() {
            waitsFor(function() { return flag; });
        };

        window.TEMPLATES = {
            Frame1: function(name, data, params) { return '<h1>' + JSON.stringify([data, params]) + '</h1>'; },
            Named1: function(name, data, params) { return '<p>' + JSON.stringify([data, params, params.p1]) + '</p>'; },
            Named2: function(name, data, params) { return '<div>' + JSON.stringify([data, params, params.p2]) + '</div>'; },

            Frame2: function(name, data, params) { return '<h2>Frame2</h2>'; },
            Named3: function(name, data, params) { return '<span>Named3</span>'; },
            Named4: function(name, data, params) { return '<span>Named4</span>'; },
            Named5: function(name, data, params) { return '<span>Named5</span>'; },
            Named6: function(name, data, params) { return '<span>Named6</span>'; },
            Named7: function(name, data, params) { return '<span>Named7</span>'; },

            Frame3: function(name, data, params) { return '<h3>' + JSON.stringify(data) + '</h3>'; },
            Named8: function(name, data, params) { return '<em>' + JSON.stringify(data) + '</em>'; },

            NamedForm: function(name, data, params) { return '<div><form><input type="text" name="field" value="val"></form></div>'; },
            NamedFormOK: function(name, data, params) { return '<strong>' + JSON.stringify(data) + '</strong>'; }
        };

        $CR
            .add('/frame1?p1=:p1&p2=:p2', {
                id: 'frame1',
                render: 'Frame1',
                named: {
                    n1: {
                        render: 'Named1'
                    },
                    n2: {
                        render: 'Named2'
                    }
                }
            })
            .add('/frame2', {
                id: 'frame2',
                render: 'Frame2',
                named: {
                    n3: {
                        render: 'Named3'
                    },
                    n4: {
                        render: 'Named4'
                    }
                },
                frames: {
                    '/sub1': {
                        id: 'frame2sub1',
                        render: 'Frame2Sub1',
                        named: {
                            n5: {
                                render: 'Named5'
                            }
                        }
                    },
                    '/sub2': {
                        id: 'frame2sub2',
                        render: 'Frame2Sub2',
                        named: {
                            n6: {
                                render: 'Named6'
                            },
                            n7: {
                                render: 'Named7'
                            }
                        }
                    }
                }
            })
            .add('/frame3', {
                id: 'frame3',
                data: '/api/frame3',
                render: 'Frame3',
                named: {
                    n3: {
                        render: 'Named3'
                    },
                    n8: {
                        data: '/api/named',
                        render: 'Named8'
                    }
                }
            })
            .add('/frame4', {
                id: 'frame4',
                render: 'Frame4',
                named: {
                    nform: {
                        render: 'NamedForm',
                        form: {
                            action: '/api/named/form',
                            method: 'POST',
                            render: 'NamedFormOK'
                        }
                    }
                }
            })
            .run({callTemplate: testCallTemplate});

        $CR.set('/frame1?p1=v1&p2=v2');
        expect(objectifyBody()).toEqual([
            {name: 'h1', value: ['[null,{"p1":"v1","p2":"v2"}]']}
        ]);

        $CR.get('frame1').named('n1');
        expect(objectifyBody()).toEqual([
            {name: 'h1', value: ['[null,{"p1":"v1","p2":"v2"}]']},
            {name: 'p', value: ['[null,{},"v1"]']}
        ]);

        $CR.get('frame1').named('n2');
        expect(objectifyBody()).toEqual([
            {name: 'h1', value: ['[null,{"p1":"v1","p2":"v2"}]']},
            {name: 'p', value: ['[null,{},"v1"]']},
            {name: 'div', value: ['[null,{},"v2"]']}
        ]);

        $CR.get('frame1').named('n1');
        expect(objectifyBody()).toEqual([
            {name: 'h1', value: ['[null,{"p1":"v1","p2":"v2"}]']},
            {name: 'div', value: ['[null,{},"v2"]']}
        ]);

        $CR.get('frame1').named('n2', true);
        $CR.get('frame1').named('n1');
        expect(objectifyBody()).toEqual([
            {name: 'h1', value: ['[null,{"p1":"v1","p2":"v2"}]']},
            {name: 'div', value: ['[null,{},"v2"]']},
            {name: 'p', value: ['[null,{},"v1"]']}
        ]);

        $CR.set('/frame2');
        expect(objectifyBody()).toEqual([
            {name: 'h2', value: ['Frame2']}
        ]);

        $CR.get('frame2').named('n4');
        expect(objectifyBody()).toEqual([
            {name: 'h2', value: ['Frame2']},
            {name: 'span', value: ['Named4']}
        ]);

        $CR.set('/frame2/sub1');
        expect(objectifyBody()).toEqual([
            {name: 'h2', value: ['Frame2']},
            {name: 'span', value: ['Named4']},
            {name: 'div', value: ['Frame2Sub1']},
            {name: 'p', value: ['/frame2/sub1']}
        ]);

        $CR.get('frame2').named('n3');
        expect(objectifyBody()).toEqual([
            {name: 'h2', value: ['Frame2']},
            {name: 'span', value: ['Named4']},
            {name: 'div', value: ['Frame2Sub1']},
            {name: 'p', value: ['/frame2/sub1']},
            {name: 'span', value: ['Named3']}
        ]);

        $CR.get('frame2sub1').named('n5');
        $CR.get('frame2sub1').named('n100500');
        $CR.get('frame2sub2').named('n6');
        expect(objectifyBody()).toEqual([
            {name: 'h2', value: ['Frame2']},
            {name: 'span', value: ['Named4']},
            {name: 'div', value: ['Frame2Sub1']},
            {name: 'p', value: ['/frame2/sub1']},
            {name: 'span', value: ['Named3']},
            {name: 'span', value: ['Named5']}
        ]);

        $CR.set('/frame2/sub2');
        expect(objectifyBody()).toEqual([
            {name: 'h2', value: ['Frame2']},
            {name: 'span', value: ['Named4']},
            {name: 'span', value: ['Named3']},
            {name: 'div', value: ['Frame2Sub2']},
            {name: 'p', value: ['/frame2/sub2']}
        ]);

        $CR.get('frame2sub2').named('n7');
        $CR.get('frame2sub1').named('n5');
        $CR.get('frame2sub2').named('n6');
        expect(objectifyBody()).toEqual([
            {name: 'h2', value: ['Frame2']},
            {name: 'span', value: ['Named4']},
            {name: 'span', value: ['Named3']},
            {name: 'div', value: ['Frame2Sub2']},
            {name: 'p', value: ['/frame2/sub2']},
            {name: 'span', value: ['Named7']},
            {name: 'span', value: ['Named6']}
        ]);

        $CR.set('/frame2');
        expect(objectifyBody()).toEqual([
            {name: 'h2', value: ['Frame2']},
            {name: 'span', value: ['Named4']},
            {name: 'span', value: ['Named3']}
        ]);

        $CR.set('/frame1?p1=vv1&p2=vv2');
        expect(objectifyBody()).toEqual([
            {name: 'h1', value: ['[null,{"p1":"vv1","p2":"vv2"}]']}
        ]);

        $CR.get('frame1').named('n2');
        expect(objectifyBody()).toEqual([
            {name: 'h1', value: ['[null,{"p1":"vv1","p2":"vv2"}]']},
            {name: 'div', value: ['[null,{},"vv2"]']}
        ]);

        $CR.set('/frame3');
        $CR.get('frame3').named('n3');
        $CR.get('frame3').named('n8');
        expect(objectifyBody()).toEqual([
            {name: 'span', value: ['Named3']}
        ]);

        waitInit();

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'h3', value: ['{"url":"/api/frame3","method":"GET"}']},
                {name: 'span', value: ['Named3']},
                {name: 'em', value: ['{"url":"/api/named","method":"GET"}']}
            ]);

            $CR.set('/frame4');
            $CR.get('frame4').named('nform');

            expect(objectifyBody()).toEqual([
                {name: 'div', value: ['Frame4']},
                {name: 'p', value: ['/frame4']},
                {name: 'div', value: [
                    {name: 'form', value: [
                        {name: 'input', value: [], attr: {type: 'text', value: 'val', name: 'field'}}
                    ]}
                ]}
            ]);

            var e = document.createEvent('HTMLEvents');
            e.initEvent('submit', true, true);
            document.forms[0].dispatchEvent(e);

            expect(objectifyBody()).toEqual([
                {name: 'div', value: ['Frame4']},
                {name: 'p', value: ['/frame4']},
                {name: 'div', value: [
                    {name: 'form', value: [
                        {name: 'input', value: [], attr: {type: 'text', value: 'val', name: 'field', disabled: ''}}
                    ]}
                ]}
            ]);

            waitInit();
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'div', value: ['Frame4']},
                {name: 'p', value: ['/frame4']},
                {name: 'strong', value: ['{"url":"/api/named/form","method":"POST","body":"field=val"}']}
            ]);

            $CR.get('frame4').named('nform');

            expect(objectifyBody()).toEqual([
                {name: 'div', value: ['Frame4']},
                {name: 'p', value: ['/frame4']}
            ]);
        });
    });
});
