describe('Simple test', function() {
    it('runs simple test', function() {
        var events = [];

        $CR
            .add('/?param=:p', {
                id: 'welcome',
                title: function(params) {
                    events.push(JSON.stringify([params, this.id]));
                    return 'Welcome';
                },
                render: 'WelcomeTemplate',
                on: {
                    before: function(e) { events.push(e + ' inside ' + this.id); },
                    success: [function(e) { events.push(e + ' inside 1 ' + this.id); }, function(e) { events.push(e + ' inside 2 ' + this.id); }],
                    after: [function(e) { events.push(e + ' inside ' + this.id); }],
                    leave: function(e) { events.push(e + ' inside ' + this.id); }
                }
            })
            .add('/about', {
                id: 'about',
                title: 'About',
                render: 'AboutTemplate'
            })
            .add(null, {
                id: 'not-found',
                title: 'Not Found',
                render: 'NotFoundTemplate'
            })
            .run({callTemplate: testCallTemplate});

        $CR.on('before success error after stop except leave busy idle', function(e) {
            events.push(e + ' ' + this.id);
        });

        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['NotFoundTemplate']},
            {name: 'p', value: ['/context.html']}
        ]);
        expect(events).toEqual([]);


        $CR.set('/?param=hello');
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['WelcomeTemplate']},
            {name: 'p', value: ['/']}
        ]);
        expect(events).toEqual([
            'leave not-found',
            '[{"p":"hello"},"welcome"]',
            'before inside welcome',
            'before welcome',
            'success inside 1 welcome',
            'success inside 2 welcome',
            'success welcome',
            'after inside welcome',
            'after welcome'
        ]);
        events = [];


        $CR.set('/about');
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['AboutTemplate']},
            {name: 'p', value: ['/about']}
        ]);
        expect(events).toEqual([
            'leave inside welcome',
            'leave welcome',
            'before about',
            'success about',
            'after about'
        ]);
        events = [];


        $CR.set('/blah');
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['NotFoundTemplate']},
            {name: 'p', value: ['/blah']}
        ]);
        expect(events).toEqual([
            'leave about',
            'before not-found',
            'success not-found',
            'after not-found'
        ]);
        events = [];


        window.history.back();
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['AboutTemplate']},
            {name: 'p', value: ['/about']}
        ]);
        expect(events).toEqual([
            'leave not-found',
            'before about',
            'success about',
            'after about'
        ]);
        events = [];


        window.history.back();
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['WelcomeTemplate']},
            {name: 'p', value: ['/']}
        ]);
        expect(events).toEqual([
            'leave about',
            '[{"p":"hello"},"welcome"]',
            'before inside welcome',
            'before welcome',
            'success inside 1 welcome',
            'success inside 2 welcome',
            'success welcome',
            'after inside welcome',
            'after welcome'
        ]);
        events = [];


        window.history.forward();
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['AboutTemplate']},
            {name: 'p', value: ['/about']}
        ]);
        expect(events).toEqual([
            'leave inside welcome',
            'leave welcome',
            'before about',
            'success about',
            'after about'
        ]);
        events = [];
    });
});
