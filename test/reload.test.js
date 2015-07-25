describe('Reload test', function() {
    it('runs reload test', function() {
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
            world: function(name, data, params) { return '<div>' + data + '</div>'; }
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
        });
    });
});
