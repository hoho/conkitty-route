describe('Autoupdate test', function() {
    it('runs autoupdate test', function() {
        var flag;
        var waitInit = function() {
            flag = false;
            setTimeout(function() { flag = true; }, 500);
        };
        var wait = function() {
            waitsFor(function() { return flag; });
        };

        window.TEMPLATES.Template1 =
        window.TEMPLATES.Template2 =
        window.TEMPLATES.Template3 = function(name, data, params) {
            return '<span>' + JSON.stringify([name, data, params]) + '</span>';
        };

        var callNumber = 0,
            events = [];

        $CR
            .add('/sub1/', {
                id: 'frame0',
                render: 'Template0',
                frames: {
                    '/:p1/data1': {
                        id: 'frame1',
                        update: 600,
                        data: $CR.DATA({uri: function() { return '/api/data1/' + ++callNumber; }}),
                        render: 'Template1',
                        frames: {
                            '?p2=:p2': {
                                id: 'frame2',
                                data: $CR.DATA({uri: function(params) { return '/api/data2/' + callNumber + '/' + params.p2; }}),
                                render: 'Template2'
                            },
                            '?p1=p1': {
                                id: 'frame4',
                                render: 'Template4'
                            },
                            '?p3=:p3': {
                                id: 'frame3',
                                data: $CR.DATA({uri: function(params) { return '/api/data3/' + callNumber + '/' + params.p3; }}),
                                render: 'Template3'
                            }
                        }
                    }
                }
            })
            .add(null, {
                id: 'not-found',
                title: 'Not Found',
                render: 'NotFoundTemplate'
            })
            .on('before success error after stop except leave busy idle', function(event) {
                events.push(event + ' ' + this.id);
            })
            .run({callTemplate: testCallTemplate});

        var PARAM1 = Math.random(),
            PARAM2 = Math.random(),
            PARAM3 = Math.random();

        $CR.set($CR.makeURI('/sub1/:p1/data1?p1=p1&p2=:p2&p3=:p3', {
            p1: PARAM1,
            p2: PARAM2,
            p3: PARAM3
        }));

        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['Template0']},
            {name: 'p', value: ['/sub1/' + PARAM1 + '/data1']}
        ]);

        expect(events).toEqual([
            'before not-found',
            'success not-found',
            'after not-found',
            'leave not-found',
            'before frame0',
            'success frame0',
            'after frame0',
            'before frame1'
        ]);
        events = [];

        waitInit();
        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'div', value: ['Template0']},
                {name: 'p', value: ['/sub1/' + PARAM1 + '/data1']},
                {name: 'span', value: ['["Template1",{"url":"/api/data1/1","method":"GET"},{"p1":"' + PARAM1 + '"}]']},
                {name: 'span', value: ['["Template2",{"url":"/api/data2/1/' + PARAM2 + '","method":"GET"},{"p2":"' + PARAM2 + '"}]']},
                {name: 'div', value: ['Template4']},
                {name: 'p', value: ['/sub1/' + PARAM1 + '/data1']},
                {name: 'span', value: ['["Template3",{"url":"/api/data3/1/' + PARAM3 + '","method":"GET"},{"p3":"' + PARAM3 + '"}]']}
            ]);

            expect(events).toEqual([
                'busy undefined',
                'success frame1',
                'after frame1',
                'before frame2',
                'before frame4',
                'success frame4',
                'after frame4',
                'before frame3',
                'success frame2',
                'after frame2',
                'success frame3',
                'after frame3',
                'idle undefined'
            ]);
            events = [];

            waitInit();
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'div', value: ['Template0']},
                {name: 'p', value: ['/sub1/' + PARAM1 + '/data1']},
                {name: 'span', value: ['["Template1",{"url":"/api/data1/2","method":"GET"},{"p1":"' + PARAM1 + '"}]']},
                {name: 'span', value: ['["Template2",{"url":"/api/data2/2/' + PARAM2 + '","method":"GET"},{"p2":"' + PARAM2 + '"}]']},
                {name: 'div', value: ['Template4']},
                {name: 'p', value: ['/sub1/' + PARAM1 + '/data1']},
                {name: 'span', value: ['["Template3",{"url":"/api/data3/2/' + PARAM3 + '","method":"GET"},{"p3":"' + PARAM3 + '"}]']}
            ]);

            expect(events).toEqual([]);
            events = [];

            waitInit();
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'div', value: ['Template0']},
                {name: 'p', value: ['/sub1/' + PARAM1 + '/data1']},
                {name: 'span', value: ['["Template1",{"url":"/api/data1/3","method":"GET"},{"p1":"' + PARAM1 + '"}]']},
                {name: 'span', value: ['["Template2",{"url":"/api/data2/3/' + PARAM2 + '","method":"GET"},{"p2":"' + PARAM2 + '"}]']},
                {name: 'div', value: ['Template4']},
                {name: 'p', value: ['/sub1/' + PARAM1 + '/data1']},
                {name: 'span', value: ['["Template3",{"url":"/api/data3/3/' + PARAM3 + '","method":"GET"},{"p3":"' + PARAM3 + '"}]']}
            ]);

            expect(events).toEqual([]);
            events = [];
        });
    });
});
