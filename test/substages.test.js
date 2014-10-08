describe('Substages test', function() {
    it('runs substages test', function() {
        var calls = [];

        $CR
            .add('/a', {
                render: {
                    '-before': function() { calls.push('-before1'); },
                    'before': function() { calls.push('before1'); },
                    '+before': function() { calls.push('+before1'); },
                    '-success': function() { calls.push('-success1'); },
                    'success': function() { calls.push('success1'); },
                    '+success': function() { calls.push('+success1'); },
                    '-after': function() { calls.push('-after1'); },
                    'after': function() { calls.push('after1'); },
                    '+after': function() { calls.push('+after1'); }
                },
                frames: {
                    '/:part': {
                        render: {
                            '-before': function() { calls.push('-before2'); },
                            'before': function() { calls.push('before2'); },
                            '+before': function() { calls.push('+before2'); },
                            '-success': function() { calls.push('-success2'); },
                            'success': function() { calls.push('success2'); },
                            '+success': function() { calls.push('+success2'); },
                            '-after': function() { calls.push('-after2'); },
                            'after': function() { calls.push('after2'); },
                            '+after': function() { calls.push('+after2'); }
                        }
                    }
                }
            })
            .run({callTemplate: testCallTemplate});

        $CR.set('/a');
        expect(calls).toEqual(['-before1', 'before1', '-success1', 'success1', '-after1', 'after1']);
        calls = [];

        $CR.set('/a');
        expect(calls).toEqual([]);
        calls = [];

        $CR.set('/a/b');
        expect(calls).toEqual(['-before2', 'before2', '-success2', 'success2', '-after2', 'after2']);
        calls = [];

        $CR.set('/a/c');
        expect(calls).toEqual(['before2', '+before2', 'success2', '+success2', 'after2', '+after2']);
    });
});
