describe('Default render DOM cleanup test', function() {
    it('runs DOM cleanup test', function() {
        var flag;
        var waitInit = function() {
            flag = false;
            setTimeout(function() { flag = true; }, 50);
        };
        var wait = function() {
            waitsFor(function() { return flag; });
        };

        var makeError = true;

        $CR
            .add('/render', {
                data: function() {
                    return new Promise(function(resolve, reject) {
                        if (makeError) {
                            makeError = false;
                            reject(222);
                        } else {
                            resolve(111);
                        }
                    });
                },
                frames: {
                    '/sub': {
                        render: 'Sub'
                    }
                }
            })
            .run({
                render: {error: 'Error'},
                callTemplate: testCallTemplate
            });

        $CR.set('/render/sub');
        expect(objectifyBody()).toEqual([]);

        waitInit();
        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'div', value: ['Error']},
                {name: 'p', value: ['/render/sub' ]}
            ]);

            $CR.set('/render/sub');

            expect(objectifyBody()).toEqual([
                {name: 'div', value: ['Error']},
                {name: 'p', value: ['/render/sub' ]}
            ]);

            waitInit();
        });

        wait();

        runs(function() {
            expect(objectifyBody()).toEqual([
                {name: 'div', value: ['Sub']},
                {name: 'p', value: ['/render/sub']}
            ]);
        });
    });
});
