describe('Complex example', function() {
    it('runs complex example', function() {
        var flag;
        var waitInit = function() {
            flag = false;
            setTimeout(function() { flag = true; }, 500);
        };
        var wait = function() {
            waitsFor(function() { return flag; });
        };

        window.TEMPLATES = {
            StagesBefore: '<div>before</div>',
            Stages: '<div>1<div class="sub"></div>2<div class="sub2"></div>3</div>',
            StagesAfter: 'after',
            StagesSuccess: '<p>success</p>'
        };

        var functionCalls = [];

        $CR
            .add('/stages', {
                title: 'Stages',
                data: '/api/data',
                render: {
                    before: 'StagesBefore',
                    success: 'Stages',
                    error: 'StagesError',
                    after: [{template: 'StagesAfter', replace: false}, 'StagesAfter']
                },
                frames: {
                    '/sub1': {
                        title: 'Stages Sub1',
                        data: '/api/sub1',
                        parent: '.sub',
                        render: {
                            before: ['StagesBefore', function() { return document.createTextNode('bebebe'); }, {parent: '.sub2', template: 'StagesBefore'}, function() { return false; }, 'StagesBefore'],
                            success: ['StagesSuccess', function() { functionCalls.push('sub-success1'); }, 'StagesSuccess'],
                            error: 'StagesError',
                            after: 'StagesAfter'
                        }
                    },
                    'sub2': {
                        title: 'Stages Sub2',
                        data: '/api/sub2',
                        render: {
                            before: [function() { return 'StagesBefore'; }, {template: function() { return 'StagesBefore'; }}, {parent: '.sub2', template: function() { return document.createTextNode('bebe'); }}],
                            error: 'StagesError',
                            success: function() { return 'SomeSuccess'}
                        }
                    },
                    'sub3': {
                        title: 'Stages Sub3',
                        data: '/none/sub2',
                        parent: '.sub2',
                        render: {
                            before: 'StagesBefore',
                            success: 'StagesSuccess',
                            error: 'StagesError'
                        }
                    },
                    '/:sub4': {
                        params: {sub4: function(val) { return val === 'sub4' ? val : undefined; }},
                        title: 'Stages Sub4',
                        data: ['/api/data1', function() { return new Promise(function(resolve) { setTimeout(function() { resolve('oooo'); }, 100); }); }, '/api/data2'],
                        render: {
                            success: function(data1, data2, data3, params) {
                                return HTML2DOM('<h1>' + JSON.stringify(data1) + '</h1>' +
                                                '<h2>' + JSON.stringify(data2) + '</h2>' +
                                                '<h3>' + JSON.stringify(data3) + '</h3>' +
                                                '<h4>' + JSON.stringify(params) + '</h4>');
                            }
                        }
                    }

                }
            })
            .run({callTemplate: testCallTemplate});

        $CR.set('/stages');
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['before']}
        ]);

        expect(document.title).toEqual('Stages');

        waitInit();
        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [], attr: {class: 'sub'}},
                    '2',
                    {name: 'div', value: [], attr: {class: 'sub2'}},
                    '3'
                ]},
                'after',
                'after'
            ]);

            $CR.set('/stages/sub1');
            waitInit();

            expect(document.title).toEqual('Stages Sub1');

            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [
                        {name: 'div', value: ['before']},
                        'bebebe'
                    ], attr: {class: 'sub'}},
                    '2',
                    {name: 'div', value: [
                        {name: 'div', value: ['before']}
                    ], attr: {class: 'sub2'}},
                    '3'
                ]},
                'after',
                'after'
            ]);
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: ['after'], attr: {class: 'sub'}},
                    '2',
                    {name: 'div', value: [], attr: {class: 'sub2'}},
                    '3'
                ]},
                'after',
                'after'
            ]);

            $CR.set('/stages/sub2');
            waitInit();

            expect(document.title).toEqual('Stages Sub2');

            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [], attr: {class: 'sub'}},
                    '2',
                    {name: 'div', value: [
                        'bebe'
                    ], attr: {class: 'sub2'}},
                    '3'
                ]},
                'after',
                'after',
                {name: 'div', value: ['before']},
                {name: 'div', value: ['before']}
            ]);
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [], attr: {class: 'sub'}},
                    '2',
                    {name: 'div', value: [], attr: {class: 'sub2'}},
                    '3'
                ]},
                'after',
                'after',
                {name: 'div', value: ['SomeSuccess']},
                {name: 'p', value: ['/stages/sub2']}
            ]);

            $CR.set('/stages/sub3');
            waitInit();

            expect(document.title).toEqual('Stages Sub3');

            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [], attr: {class: 'sub'}},
                    '2',
                    {name: 'div', value: [
                        {name: 'div', value: ['before']}
                    ], attr: {class: 'sub2'}},
                    '3'
                ]},
                'after',
                'after'
            ]);
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [], attr: {class: 'sub'}},
                    '2',
                    {name: 'div', value: [
                        {name: 'div', value: ['StagesError']},
                        {name: 'p', value: ['/stages/sub3']}
                    ], attr: {class: 'sub2'}},
                    '3'
                ]},
                'after',
                'after'
            ]);

            $CR.set('/stages/sub4');
            waitInit();

            expect(document.title).toEqual('Stages Sub4');

            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [], attr: {class: 'sub'}},
                    '2',
                    {name: 'div', value: [
                        {name: 'div', value: ['StagesError']},
                        {name: 'p', value: ['/stages/sub3']}
                    ], attr: {class: 'sub2'}},
                    '3'
                ]},
                'after',
                'after'
            ]);
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'div', value: [
                    '1',
                    {name: 'div', value: [], attr: {class: 'sub'}},
                    '2',
                    {name: 'div', value: [], attr: {class: 'sub2'}},
                    '3'
                ]},
                'after',
                'after',
                {name: 'h1', value: ['{"url":"/api/data1","method":"GET"}']},
                {name: 'h2', value: ['"oooo"']},
                {name: 'h3', value: ['{"url":"/api/data2","method":"GET"}']},
                {name: 'h4', value: ['{"sub4":"sub4"}']}
            ]);
        });
    });
});
