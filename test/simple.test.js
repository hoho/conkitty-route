describe('Simple example', function() {
    it('runs simple example', function() {
        $CR
            .add('/', {title: 'Welcome', render: 'WelcomeTemplate'})
            .add('/about', {title: 'About', render: 'AboutTemplate'})
            .add(null, {title: 'Not Found', render: 'NotFoundTemplate'})
            .run({callTemplate: testCallTemplate});

        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['NotFoundTemplate']},
            {name: 'p', value: ['/context.html']}
        ]);

        $CR.set('/');
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['WelcomeTemplate']},
            {name: 'p', value: ['/']}
        ]);

        $CR.set('/about');
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['AboutTemplate']},
            {name: 'p', value: ['/about']}
        ]);

        $CR.set('/blah');
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['NotFoundTemplate']},
            {name: 'p', value: ['/blah']}
        ]);

        window.history.back();
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['AboutTemplate']},
            {name: 'p', value: ['/about']}
        ]);

        window.history.back();
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['WelcomeTemplate']},
            {name: 'p', value: ['/']}
        ]);

        window.history.forward();
        expect(objectifyBody()).toEqual([
            {name: 'div', value: ['AboutTemplate']},
            {name: 'p', value: ['/about']}
        ]);
    });
});
