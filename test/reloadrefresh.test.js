describe('Reload and refresh test', function() {
    it('runs reload and refresh test', function() {
        var flag;
        var waitInit = function(timeout) {
            flag = false;
            setTimeout(function() { flag = true; }, timeout);
        };
        var wait = function() {
            waitsFor(function() { return flag; });
        };

        window.TEMPLATES = {
            hello: function(name, data, params) { return '<h1>' + (typeof data === 'string' ? data : JSON.stringify(data)) + '</h1>'; },
            world: function(name, data, params) { return '<div>' + data + '</div>'; },
            p: function(name, data, params) { return '<p>' + this.id + ' ' + data + '</p>'; }
        };

        var dataCounter = 0;
        var events = [];

        $CR
            .add(null, {title: 'Not Found', render: 'NotFoundTemplate'})
            .add('/hello', {
                id: 'hello',
                data: function() { return new Promise(function(resolve) { setTimeout(function() { resolve('hello' + ++dataCounter); }, 100); }); },
                render: 'hello',
                frames: {
                    '/world': {
                        id: 'world',
                        data: function() { return new Promise(function(resolve) { setTimeout(function() { resolve('world' + ++dataCounter); }, 100); }); },
                        refresh: function() { events.push('refresh call'); return 300; },
                        render: 'world'
                    }
                }
            })
            .add('/refresh', {
                frames: {
                    '?p1=1': {
                        id: 'p1',
                        tags: 'tag1 tag2 tag3',
                        data: function() { return ++dataCounter; },
                        render: 'p'
                    },
                    '?p2=2': {
                        id: 'p2',
                        tags: 'tag2',
                        data: function() { return ++dataCounter; },
                        render: 'p'
                    },
                    '?p3=3': {
                        id: 'p3',
                        tags: 'tag3',
                        data: function() { return ++dataCounter; },
                        render: 'p'
                    }
                }
            })
            .add('/pause', {
                frames: {
                    '?p1=1': {
                        id: 'pause1',
                        tags: 'tag1',
                        data: function() { return ++dataCounter; },
                        refresh: 100,
                        render: 'p'
                    },
                    '?p2=2': {
                        id: 'pause2',
                        tags: 'tag2',
                        data: function() { return ++dataCounter; },
                        refresh: 100,
                        render: 'p'
                    },
                    '?p3=3': {
                        id: 'pause3',
                        tags: 'tag3',
                        data: function() { return ++dataCounter; },
                        refresh: 100,
                        render: 'p'
                    },
                    '?p4=4': {
                        id: 'pause4',
                        refresh: $CR.$.refresh({pause: 'tag1 tag3'}),
                        data: function() { return ++dataCounter; },
                        render: 'p'
                    },
                    '?p5=5': {
                        id: 'pause5',
                        refresh: $CR.$.refresh({pause: 'tag2'}),
                        data: function() { return ++dataCounter; },
                        render: 'p'
                    }
                }
            })
            .run({callTemplate: testCallTemplate});

        $CR.on('before success error after stop except leave busy idle xhr', function(e) {
            events.push(e + (this.id ? ' ' + this.id : ''));
        });

        $CR.set('/hello/world');
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['NotFoundTemplate']},
            {name: 'p', value: ['/context.html']}
        ]);

        $CR.get('hello').refresh(); // Should be ignored.
        $CR.get('world').refresh(); // Should be ignored.

        waitInit(300);
        wait();

        runs(function() {
            expect(events).toEqual([
                'leave',
                'before hello',
                'busy',
                'success hello',
                'after hello',
                'before world',
                'success world',
                'after world',
                'refresh call',
                'idle'
            ]);
            events = [];

            expect(objectifyBody()).toEqual([
                {name: 'h1', value: ['hello1']},
                {name: 'div', value: ['world2']}
            ]);

            $CR.get('hello').refresh();

            waitInit(300);
        });

        wait();

        runs(function() {
            expect(events).toEqual([
                'refresh call'
            ]);
            events = [];

            expect(objectifyBody()).toEqual([
                {name: 'h1', value: ['hello3']},
                {name: 'div', value: ['world5']}
            ]);

            $CR.get('hello').refresh('/api/ololo');

            waitInit(300);
        });

        wait();

        runs(function() {
            expect(events).toEqual([
                'xhr hello',
                'xhr hello'
            ]);
            events = [];

            expect(objectifyBody()).toEqual([
                {name: 'h1', value: ['{"url":"/api/ololo","method":"GET"}']},
                {name: 'div', value: ['world6']}
            ]);

            $CR.get('hello').reload();

            expect(objectifyBody()).toEqual([
                {name: 'h1', value: ['{"url":"/api/ololo","method":"GET"}']},
                {name: 'div', value: ['world6']}
            ]);

            waitInit(150);
        });

        wait();

        runs(function() {
            expect(events).toEqual([
                'before hello',
                'busy',
                'success hello',
                'after hello',
                'before world'
            ]);
            events = [];

            expect(objectifyBody()).toEqual([
                {name: 'h1', value: ['hello8']}
            ]);

            $CR.get('hello').reload();

            expect(objectifyBody()).toEqual([
                {name: 'h1', value: ['hello8']}
            ]);

            waitInit(150);
        });

        wait();

        runs(function() {
            expect(events).toEqual([
                'stop world',
                'before hello',
                'success hello',
                'after hello',
                'before world'
            ]);
            events = [];

            expect(objectifyBody()).toEqual([
                {name: 'h1', value: ['hello10']}
            ]);

            waitInit(100);
        });

        wait();

        runs(function() {
            expect(events).toEqual([
                'success world',
                'after world',
                'refresh call',
                'idle'
            ]);
            events = [];

            expect(objectifyBody()).toEqual([
                {name: 'h1', value: ['hello10']},
                {name: 'div', value: ['world11']}
            ]);

            waitInit(400);
        });

        wait();

        runs(function() {
            expect(events).toEqual([
                'refresh call'
            ]);
            events = [];

            expect(objectifyBody()).toEqual([
                {name: 'h1', value: ['hello10']},
                {name: 'div', value: ['world12']}
            ]);

            $CR.get('world').reload();
            $CR.get('world').reload();
            $CR.get('hello').refresh(); // Should be ignored.
            $CR.get('world').reload();

            expect(objectifyBody()).toEqual([
                {name: 'h1', value: ['hello10']},
                {name: 'div', value: ['world12']}
            ]);

            waitInit(150);
        });

        wait();

        runs(function() {
            expect(events).toEqual([
                'before world',
                'stop world',
                'before world',
                'stop world',
                'before world',
                'busy',
                'success world',
                'after world',
                'refresh call',
                'idle'
            ]);
            events = [];

            expect(objectifyBody()).toEqual([
                {name: 'h1', value: ['hello10']},
                {name: 'div', value: ['world15']}
            ]);

            $CR.set('/refresh?p1=1&p2=2&p3=3');

            expect(objectifyBody()).toEqual([
                {name: 'p', value: ['p1 16']},
                {name: 'p', value: ['p2 17']},
                {name: 'p', value: ['p3 18']}
            ]);

            $CR.refresh('tag1 tag2 tag3 tag4');

            waitInit(50);
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'p', value: ['p1 19']},
                {name: 'p', value: ['p2 20']},
                {name: 'p', value: ['p3 21']}
            ]);

            $CR.refresh('tag1');

            waitInit(50);
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'p', value: ['p1 22']},
                {name: 'p', value: ['p2 20']},
                {name: 'p', value: ['p3 21']}
            ]);

            $CR.refresh('tag2');

            waitInit(50);
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'p', value: ['p1 23']},
                {name: 'p', value: ['p2 24']},
                {name: 'p', value: ['p3 21']}
            ]);

            $CR.refresh('tag3');

            waitInit(50);
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'p', value: ['p1 25']},
                {name: 'p', value: ['p2 24']},
                {name: 'p', value: ['p3 26']}
            ]);

            $CR.set('/pause?p1=1&p2=2&p3=3&p4=4&p5=5');

            expect(objectifyBody()).toEqual([
                {name: 'p', value: ['pause1 27']},
                {name: 'p', value: ['pause2 28']},
                {name: 'p', value: ['pause3 29']},
                {name: 'p', value: ['pause4 30']},
                {name: 'p', value: ['pause5 31']}
            ]);

            waitInit(150);
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'p', value: ['pause1 27']},
                {name: 'p', value: ['pause2 28']},
                {name: 'p', value: ['pause3 29']},
                {name: 'p', value: ['pause4 30']},
                {name: 'p', value: ['pause5 31']}
            ]);

            $CR.set('/pause?p1=1&p2=2&p3=3&p4=4');

            expect(objectifyBody()).toEqual([
                {name: 'p', value: ['pause1 27']},
                {name: 'p', value: ['pause2 28']},
                {name: 'p', value: ['pause3 29']},
                {name: 'p', value: ['pause4 30']}
            ]);

            waitInit(150);
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'p', value: ['pause1 27']},
                {name: 'p', value: ['pause2 32']},
                {name: 'p', value: ['pause3 29']},
                {name: 'p', value: ['pause4 30']}
            ]);

            $CR.set('/pause?p1=1&p2=2&p3=3&p5=5');

            expect(objectifyBody()).toEqual([
                {name: 'p', value: ['pause1 27']},
                {name: 'p', value: ['pause2 32']},
                {name: 'p', value: ['pause3 29']},
                {name: 'p', value: ['pause5 33']}
            ]);

            waitInit(150);
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'p', value: ['pause1 34']},
                {name: 'p', value: ['pause2 32']},
                {name: 'p', value: ['pause3 35']},
                {name: 'p', value: ['pause5 33']}
            ]);
        });
    });
});
