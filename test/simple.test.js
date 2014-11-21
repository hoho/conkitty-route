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
                data: $CR.STATIC({hello: 'world'}),
                render: function(data) { events.push(data); return 'WelcomeTemplate'; },
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
                render: 'AboutTemplate',
                group: [
                    {id: 'about_sub1', render: 'AboutTemplateSub1'},
                    {id: 'about_sub2', render: 'AboutTemplateSub2'}
                ],
                frames: {
                    '/it': {
                        id: 'about_sub3',
                        render: 'AboutTemplateSub3',
                        group: [
                            {id: 'about_sub4', render: 'AboutTemplateSub4'},
                            {id: 'about_sub5', render: 'AboutTemplateSub5'}
                        ],
                        frames: {
                            '/yes': {
                                id: 'about_sub6',
                                render: 'AboutTemplateSub6'
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
            .run({callTemplate: testCallTemplate});

        $CR.on('before success error after stop except leave busy idle', function(e) {
            events.push(e + ' ' + this.id);
            //if (!this.id) { console.log(this); }
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
            {hello: 'world'},
            'success inside 1 welcome',
            'success inside 2 welcome',
            'success welcome',
            'after inside welcome',
            'after welcome'
        ]);
        events = [];


        $CR.set('/about/it/yes');
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['AboutTemplate']},
            {name: 'p', value: ['/about']},
            {name: 'div', value: ['AboutTemplateSub1']},
            {name: 'p', value: ['/about']},
            {name: 'div', value: ['AboutTemplateSub2']},
            {name: 'p', value: ['/about']}
        ]);
        expect(events).toEqual([
            'leave inside welcome',
            'leave welcome',
            'before about',
            'success about',
            'after about',
            'before about_sub1',
            'success about_sub1',
            'after about_sub1',
            'before about_sub2',
            'success about_sub2',
            'after about_sub2'
        ]);
        events = [];


        $CR.set('/blah');
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['NotFoundTemplate']},
            {name: 'p', value: ['/blah']}
        ]);
        expect(events).toEqual([
            'leave about_sub1',
            'leave about_sub2',
            'leave about',
            'before not-found',
            'success not-found',
            'after not-found'
        ]);
        events = [];


        window.history.back();
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['AboutTemplate']},
            {name: 'p', value: ['/about']},
            {name: 'div', value: ['AboutTemplateSub1']},
            {name: 'p', value: ['/about']},
            {name: 'div', value: ['AboutTemplateSub2']},
            {name: 'p', value: ['/about']}
        ]);
        expect(events).toEqual([
            'leave not-found',
            'before about',
            'success about',
            'after about',
            'before about_sub1',
            'success about_sub1',
            'after about_sub1',
            'before about_sub2',
            'success about_sub2',
            'after about_sub2'
        ]);
        events = [];


        window.history.back();
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['WelcomeTemplate']},
            {name: 'p', value: ['/']}
        ]);
        expect(events).toEqual([
            'leave about_sub1',
            'leave about_sub2',
            'leave about',
            '[{"p":"hello"},"welcome"]',
            'before inside welcome',
            'before welcome',
            {hello: 'world'},
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
            {name: 'p', value: ['/about']},
            {name: 'div', value: ['AboutTemplateSub1']},
            {name: 'p', value: ['/about']},
            {name: 'div', value: ['AboutTemplateSub2']},
            {name: 'p', value: ['/about']}
        ]);
        expect(events).toEqual([
            'leave inside welcome',
            'leave welcome',
            'before about',
            'success about',
            'after about',
            'before about_sub1',
            'success about_sub1',
            'after about_sub1',
            'before about_sub2',
            'success about_sub2',
            'after about_sub2'
        ]);
        events = [];
    });
});
