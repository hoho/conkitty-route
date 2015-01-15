describe('Complex test', function() {
    it('runs complex test', function() {
        var flag;
        var waitInit = function() {
            flag = false;
            setTimeout(function() { flag = true; }, 500);
        };
        var wait = function() {
            waitsFor(function() { return flag; });
        };

        var override;

        window.TEMPLATES = {
            HelloTemplate: '<div class="hello">1<div class="param1 param2">2</div>3<div class="param3">4</div>5<div class="params">6</div>7</div>',
            Param1Template: 'param<strong>1</strong><div class="hash2"></div><div class="hash1"></div>',
            Param2Template: '<em>param2</em>',
            Param3Template: '<strong>param</strong>3',
            DeeperTemplate: function(name, data, params) { return 'deeper: ' + JSON.stringify([data, params]); },
            DeeperDeeperTemplate: function(name, data, params) { return 'deeperdeeper: ' + JSON.stringify([data, params]); },
            Hash1Template: '<p>hash1</p>',
            Hash2Template: '<p>hash2</p>',
            Override: function(name, data, params) { return '<h1>' + JSON.stringify([data, params]) + '</h1>'; }
        };

        var matcherParams;

        $CR
            .add(null, {title: 'Not Found', render: 'NotFoundTemplate'})
            .add('/hello', {
                title: 'Hello',
                render: 'HelloTemplate',
                params: {pum: 123, pam: function() { return 'lala'; }},
                frames: {
                    '?param1=:param': {
                        id: 'param1-param',
                        params: {pum: 234, pom: function() { return 'lulu'; }},
                        matcher: function(params) {
                            expect(this.id).toEqual('param1-param');
                            matcherParams.push(flattenParams(params));
                            return true;
                        },
                        data: '/api/data1?what=:param',
                        parent: 'div.param1',
                        render: 'Param1Template',
                        frames: {
                            '#hash1': {
                                parent: 'div.hash1',
                                render: 'Hash1Template'
                            },
                            '#hash2': {
                                parent: 'div.hash2',
                                render: 'Hash2Template'
                            }
                        }
                    },
                    '?param1=:custom': {
                        id: 'custom-matcher',
                        matcher: function(params) {
                            expect(this.id).toEqual('custom-matcher');
                            matcherParams.push(flattenParams(params));
                            return false;
                        },
                        render: 'CustomMatcher'
                    },
                    '?param2=:param': {
                        parent: 'div.param2',
                        render: 'Param2Template'
                    },
                    '?param3=:param': {
                        parent: 'div.param3',
                        render: 'Param3Template'
                    },
                    '?param1=world&param2=:p&param3=hello': {
                        data: '/api/data2?what=:p',
                        parent: 'div.params',
                        render: 'AllParams'
                    },
                    '/deeper?param1=world&param2=:p&param3=:p2': {
                        data: $CR.$.data({uri: '/api/data3?that=:p&those=:p2', method: 'POST'}),
                        parent: 'div.params',
                        render: 'DeeperTemplate',
                        id: 'dee',
                        frames: {
                            '?param1=:p&param2=:p3': {
                                id: 'deedee',
                                data: '/api/data4?arg1=:p&arg2=:p2&arg3=:p3',
                                render: 'DeeperDeeperTemplate'
                            }
                        }
                    }
                }
            })
            .add('/override?p1=:p1&p2=:p2', {
                data: $CR.$.data({
                    uri: '/api/override',
                    override: function(params) {
                        if (override) {
                            return {paparam: params};
                        } else {
                            override = true;
                        }
                    }
                }),
                render: 'Override'
            })
            .add('/part1', {
                render: 'Part1',
                frames: {
                    '/': [
                        {
                            frames: {
                                '/': {
                                    render: 'Part_1_1',
                                    frames: {
                                        '/part2': {
                                            render: 'Part_1_2'
                                        }
                                    }
                                }
                            }
                        },
                        {
                            frames: {
                                '/': {
                                    render: 'Part_2_1',
                                    frames: {
                                        '/part2': {
                                            partial: true,
                                            render: 'Part_2_2'
                                        }
                                    }
                                }
                            }
                        },
                        {
                            render: 'Part_3_1',
                            frames: {
                                '/part2': {
                                    render: 'Part_3_2',
                                    frames: {
                                        '/part3': {
                                            partial: true,
                                            render: 'Part_3_3'
                                        }
                                    }
                                }
                            }
                        }
                    ]
                }
            })
            .run({callTemplate: testCallTemplate});

        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['NotFoundTemplate']},
            {name: 'p', value: ['/context.html']}
        ]);

        $CR.set('/hello');
        expect(objectifyBody()).toEqual([
            {name: 'div', value: [
                '1',
                {name: 'div', value: ['2'], attr: {class: 'param1 param2'}},
                '3',
                {name: 'div', value: ['4'], attr: {class: 'param3'}},
                '5',
                {name: 'div', value: ['6'], attr: {class: 'params'}},
                '7'
            ], attr: {class: 'hello'}}
        ]);

        matcherParams = [];
        $CR.set('/hello?param1=test');
        expect(matcherParams).toEqual([
            {param: 'test', pum: 234, pom: 'lulu', pam: 'lala'},
            {custom: 'test', pum: 123, pam: 'lala'}
        ]);
        waitInit();

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [
                        '2',
                        'param',
                        {name: 'strong', value: ['1']},
                        {name: 'div', value: [], attr: {class: 'hash2'}},
                        {name: 'div', value: [], attr: {class: 'hash1'}}
                    ], attr: {class: 'param1 param2'}},
                    '3',
                    {name: 'div', value: ['4'], attr: {class: 'param3'}},
                    '5',
                    {name: 'div', value: ['6'], attr: {class: 'params'}},
                    '7'
                ], attr: {class: 'hello'}}
            ]);

            matcherParams = [];
            $CR.set('/hello?param1=test#hash1');
            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [
                        '2',
                        'param',
                        {name: 'strong', value: ['1']},
                        {name: 'div', value: [], attr: {class: 'hash2'}},
                        {name: 'div', value: [
                            {name: 'p', value: ['hash1']}
                        ], attr: {class: 'hash1'}}
                    ], attr: {class: 'param1 param2'}},
                    '3',
                    {name: 'div', value: ['4'], attr: {class: 'param3'}},
                    '5',
                    {name: 'div', value: ['6'], attr: {class: 'params'}},
                    '7'
                ], attr: {class: 'hello'}}
            ]);
            expect(matcherParams).toEqual([
                {param: 'test', pum: 234, pom: 'lulu', pam: 'lala'},
                {custom: 'test', pum: 123, pam: 'lala'}
            ]);

            matcherParams = [];
            $CR.set('/hello?param1=test#hash2');
            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [
                        '2',
                        'param',
                        {name: 'strong', value: ['1']},
                        {name: 'div', value: [
                            {name: 'p', value: ['hash2']}
                        ], attr: {class: 'hash2'}},
                        {name: 'div', value: [], attr: {class: 'hash1'}}
                    ], attr: {class: 'param1 param2'}},
                    '3',
                    {name: 'div', value: ['4'], attr: {class: 'param3'}},
                    '5',
                    {name: 'div', value: ['6'], attr: {class: 'params'}},
                    '7'
                ], attr: {class: 'hello'}}
            ]);
            expect(matcherParams).toEqual([
                {param: 'test', pum: 234, pom: 'lulu', pam: 'lala'},
                {custom: 'test', pum: 123, pam: 'lala'}
            ]);

            matcherParams = [];
            $CR.set('/hello?param2=test2');
            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [
                        '2',
                        {name: 'em', value: ['param2']}
                    ], attr: {class: 'param1 param2'}},
                    '3',
                    {name: 'div', value: ['4'], attr: {class: 'param3'}},
                    '5',
                    {name: 'div', value: ['6'], attr: {class: 'params'}},
                    '7'
                ], attr: {class: 'hello'}}
            ]);

            $CR.set('/hello?param3=test3');
            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: ['2'], attr: {class: 'param1 param2'}},
                    '3',
                    {name: 'div', value: [
                        '4',
                        {name: 'strong', value: ['param']},
                        '3'
                    ], attr: {class: 'param3'}},
                    '5',
                    {name: 'div', value: ['6'], attr: {class: 'params'}},
                    '7'
                ], attr: {class: 'hello'}}
            ]);

            $CR.set('/hello?param1=world&param2=beautiful&param3=hello');
            expect(matcherParams).toEqual([
                {param: 'world', pum: 234, pom: 'lulu', pam: 'lala'},
                {custom: 'world', pum: 123, pam: 'lala'}
            ]);
            waitInit();
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [
                        '2',
                        'param',
                        {name: 'strong', value: ['1']},
                        {name: 'div', value: [], attr: {class: 'hash2'}},
                        {name: 'div', value: [], attr: {class: 'hash1'}},
                        {name: 'em', value: ['param2']}
                    ], attr: {class: 'param1 param2'}},
                    '3',
                    {name: 'div', value: [
                        '4',
                        {name: 'strong', value: ['param']},
                        '3'
                    ], attr: {class: 'param3'}},
                    '5',
                    {name: 'div', value: [
                        '6',
                        {name: 'div', value: ['AllParams']},
                        {name: 'p', value: ['/hello']}
                    ], attr: {class: 'params'}},
                    '7'
                ], attr: {class: 'hello'}}
            ]);

            matcherParams = [];
            $CR.set('/hello/deeper?param1=world&param2=beautiful&param3=hello');
            expect(matcherParams).toEqual([
                {param: 'world', pum: 234, pom: 'lulu', pam: 'lala'},
                {custom: 'world', pum: 123, pam: 'lala'}
            ]);
            waitInit();

            // The same as in previous assertion, in this configuration DOM
            // changes when the data arrives.
            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [
                        '2',
                        'param',
                        {name: 'strong', value: ['1']},
                        {name: 'div', value: [], attr: {class: 'hash2'}},
                        {name: 'div', value: [], attr: {class: 'hash1'}},
                        {name: 'em', value: ['param2']}
                    ], attr: {class: 'param1 param2'}},
                    '3',
                    {name: 'div', value: [
                        '4',
                        {name: 'strong', value: ['param']},
                        '3'
                    ], attr: {class: 'param3'}},
                    '5',
                    {name: 'div', value: [
                        '6',
                        {name: 'div', value: ['AllParams']},
                        {name: 'p', value: ['/hello']}
                    ], attr: {class: 'params'}},
                    '7'
                ], attr: {class: 'hello'}}
            ]);
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: ['2'], attr: {class: 'param1 param2'}},
                    '3',
                    {name: 'div', value: ['4'], attr: {class: 'param3'}},
                    '5',
                    {name: 'div', value: [
                        '6',
                        'deeper: [{"url":"/api/data3?that=beautiful&those=hello","method":"POST"},{"p":"beautiful","p2":"hello"}]',
                        'deeperdeeper: [{"url":"/api/data4?arg1=world&arg2=hello&arg3=beautiful","method":"GET"},{"p":"world","p3":"beautiful"}]'
                    ], attr: {class: 'params'}},
                    '7'
                ], attr: {class: 'hello'}}
            ]);

            $CR.set('/hello');
            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: ['2'], attr: {class: 'param1 param2'}},
                    '3',
                    {name: 'div', value: ['4'], attr: {class: 'param3'}},
                    '5',
                    {name: 'div', value: ['6'], attr: {class: 'params'}},
                    '7'
                ], attr: {class: 'hello'}}
            ]);

            $CR.set('/override?p1=hello&p2=world');
            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: ['2'], attr: {class: 'param1 param2'}},
                    '3',
                    {name: 'div', value: ['4'], attr: {class: 'param3'}},
                    '5',
                    {name: 'div', value: ['6'], attr: {class: 'params'}},
                    '7'
                ], attr: {class: 'hello'}}
            ]);

            waitInit();
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'h1', value: ['[{"url":"/api/override","method":"GET"},{"p1":"hello","p2":"world"}]']}
            ]);

            $CR.set('/override?p1=beautiful&p2=indeed');

            expect(objectifyBody()).toEqual([
                {name: 'h1', value: ['[{"paparam":{"p1":"beautiful","p2":"indeed"}},{"p1":"beautiful","p2":"indeed"}]']}
            ]);

            $CR.set('/partial/part1');

            expect(objectifyBody()).toEqual([
                {name: 'div', value: ['NotFoundTemplate']},
                {name: 'p', value: [ '/partial/part1' ]}
            ]);

            $CR.set('/part1');

            expect(objectifyBody()).toEqual([
                {name: 'div', value: ['Part1']},
                {name: 'p', value: ['/part1']},
                {name: 'div', value: ['Part_1_1']},
                {name: 'p', value: ['/part1']},
                {name: 'div', value: ['Part_2_1']},
                {name: 'p', value: ['/part1']},
                {name: 'div', value: ['Part_3_1']},
                {name: 'p', value: ['/part1']}
            ]);

            $CR.set('/part1/part2');

            expect(objectifyBody()).toEqual([
                {name: 'div', value: ['Part1']},
                {name: 'p', value: ['/part1']},
                {name: 'div', value: ['Part_1_1']},
                {name: 'p', value: ['/part1']},
                {name: 'div', value: ['Part_2_1']},
                {name: 'p', value: ['/part1']},
                {name: 'div', value: ['Part_3_1']},
                {name: 'p', value: ['/part1']},
                {name: 'div', value: ['Part_1_2']},
                {name: 'p', value: ['/part1/part2']},
                {name: 'div', value: ['Part_2_2']},
                {name: 'p', value: ['/part1/part2']},
                {name: 'div', value: ['Part_3_2']},
                {name: 'p', value: ['/part1/part2']}
            ]);

            $CR.set('/part1/part2/part3');

            expect(objectifyBody()).toEqual([
                {name: 'div', value: ['Part1']},
                {name: 'p', value: ['/part1']},
                {name: 'div', value: ['Part_2_1']},
                {name: 'p', value: ['/part1']},
                {name: 'div', value: ['Part_3_1']},
                {name: 'p', value: ['/part1']},
                {name: 'div', value: ['Part_2_2']},
                {name: 'p', value: ['/part1/part2']},
                {name: 'div', value: ['Part_3_2']},
                {name: 'p', value: ['/part1/part2']},
                {name: 'div', value: ['Part_3_3']},
                {name: 'p', value: ['/part1/part2/part3']}
            ]);

            $CR.set('/part1/part2/part3/part4');

            expect(objectifyBody()).toEqual([
                {name: 'div', value: ['Part1']},
                {name: 'p', value: ['/part1']},
                {name: 'div', value: ['Part_2_1']},
                {name: 'p', value: ['/part1']},
                {name: 'div', value: ['Part_3_1']},
                {name: 'p', value: ['/part1']},
                {name: 'div', value: ['Part_2_2']},
                {name: 'p', value: ['/part1/part2']},
                {name: 'div', value: ['Part_3_2']},
                {name: 'p', value: ['/part1/part2']},
                {name: 'div', value: ['Part_3_3']},
                {name: 'p', value: ['/part1/part2/part3']}
            ]);
        });
    });
});
