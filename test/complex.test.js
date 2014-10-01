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
            HelloTemplate: '<div class="hello">1<div class="param1 param2">2</div>3<div class="param3">4</div>5<div class="params">6</div>7</div>',
            Param1Template: 'param<strong>1</strong><div class="hash2"></div><div class="hash1"></div>',
            Param2Template: '<em>param2</em>',
            Param3Template: '<strong>param</strong>3',
            DeeperTemplate: function(name, args) { return 'deeper: ' + JSON.stringify(args.slice(0, 2)); },
            Hash1Template: '<p>hash1</p>',
            Hash2Template: '<p>hash2</p>'
        };

        $CR
            .add(null, {title: 'Not Found', render: 'NotFoundTemplate'})
            .add('/hello', {
                title: 'Hello',
                render: 'HelloTemplate',
                frames: {
                    '?param1=:param': {
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
                    '/deeper?param1=world&param2=:p&param3=hello': {
                        data: '/api/data3?that=:p',
                        parent: 'div.params',
                        render: 'DeeperTemplate'
                    }
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

        $CR.set('/hello?param1=test');
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

            $CR.set('/hello/deeper?param1=world&param2=beautiful&param3=hello');
            waitInit();
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
                        'deeper: [{"url":"/api/data3?that=beautiful","method":"GET"},{"p":"beautiful"}]'
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
        });
    });
});
