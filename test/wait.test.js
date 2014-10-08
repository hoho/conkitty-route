describe('Simple example', function() {
    it('runs simple example', function() {
        var flag;
        var waitInit = function() {
            flag = false;
            setTimeout(function() { flag = true; }, 500);
        };
        var wait = function() {
            waitsFor(function() { return flag; });
        };

        var calls = [];
        $CR
            .add('/', {
                wait: true,
                data: function() { return new Promise(function(resolve) { setTimeout(function() { resolve(true); }, 50); }); },
                render: {
                    before: function() { calls.push('before1'); },
                    success: function() { calls.push('success1'); },
                    after: function() { calls.push('after1'); }
                },
                frames: {
                    'a': {
                        render: {
                            before: function() { calls.push('before2'); },
                            success: function() { calls.push('success2'); },
                            after: function() { calls.push('after2'); }
                        },
                        frames: {
                            'b': {
                                render: {
                                    before: function() { calls.push('before3'); },
                                    success: function() { calls.push('success3'); },
                                    after: function() { calls.push('after3'); }
                                },
                                frames: {
                                    'c': {
                                        wait: false,
                                        data: function() { return new Promise(function(resolve) { setTimeout(function() { resolve(true); }, 50); }); },
                                        render: {
                                            before: function() { calls.push('before4'); },
                                            success: function() { calls.push('success4'); },
                                            after: function() { calls.push('after4'); }
                                        },
                                        frames: {
                                            'd': {
                                                render: {
                                                    before: function() { calls.push('before5'); },
                                                    success: function() { calls.push('success5'); },
                                                    after: function() { calls.push('after5'); }
                                                },
                                                frames: {
                                                    'e': {
                                                        wait: true,
                                                        render: {
                                                            before: function() { calls.push('before6'); },
                                                            success: function() { calls.push('success6'); },
                                                            after: function() { calls.push('after6'); }
                                                        },
                                                        frames: {
                                                            'f': {
                                                                data: function() { return new Promise(function(resolve) { setTimeout(function() { resolve(true); }, 50); }); },
                                                                render: {
                                                                    before: function() { calls.push('before7'); },
                                                                    success: function() { calls.push('success7'); },
                                                                    after: function() { calls.push('after7'); }
                                                                },
                                                                frames: {
                                                                    'g': {
                                                                        render: {
                                                                            before: function() { calls.push('before8'); },
                                                                            success: function() { calls.push('success8'); },
                                                                            after: function() { calls.push('after8'); }
                                                                        },
                                                                        frames: {
                                                                            'h': {
                                                                                render: {
                                                                                    before: function() { calls.push('before9'); },
                                                                                    success: function() { calls.push('success9'); },
                                                                                    after: function() { calls.push('after9'); }
                                                                                },
                                                                                frames: {
                                                                                    '?p1=1': {
                                                                                        data: function() { return new Promise(function(resolve) { setTimeout(function() { resolve(true); }, 50); }); },
                                                                                        render: {
                                                                                            before: function() { calls.push('before10'); },
                                                                                            success: function() { calls.push('success10'); },
                                                                                            after: function() { calls.push('after10'); }
                                                                                        },
                                                                                        frames: {
                                                                                            '?p2=2': {
                                                                                                render: {
                                                                                                    before: function() { calls.push('before11'); },
                                                                                                    success: function() { calls.push('success11'); },
                                                                                                    after: function() { calls.push('after11'); }
                                                                                                },
                                                                                                frames: {
                                                                                                    '?p3=3': {
                                                                                                        render: {
                                                                                                            before: function() { calls.push('before12'); },
                                                                                                            success: function() { calls.push('success12'); },
                                                                                                            after: function() { calls.push('after12'); }
                                                                                                        }
                                                                                                    }
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                    },
                                                                                    '?p4=4': {
                                                                                        data: function() { return new Promise(function(resolve) { setTimeout(function() { resolve(true); }, 200); }); },
                                                                                        wait: false,
                                                                                        render: {
                                                                                            before: function() { calls.push('before13'); },
                                                                                            success: function() { calls.push('success13'); },
                                                                                            after: function() { calls.push('after13'); }
                                                                                        },
                                                                                        frames: {
                                                                                            '?p5=5': {
                                                                                                render: {
                                                                                                    before: function() { calls.push('before14'); },
                                                                                                    success: function() { calls.push('success14'); },
                                                                                                    after: function() { calls.push('after14'); }
                                                                                                },
                                                                                                frames: {
                                                                                                    '?p6=6': {
                                                                                                        render: {
                                                                                                            before: function() { calls.push('before15'); },
                                                                                                            success: function() { calls.push('success15'); },
                                                                                                            after: function() { calls.push('after15'); }
                                                                                                        }
                                                                                                    }
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                    },
                                                                                    '?p7=7': {
                                                                                        render: {
                                                                                            before: function() { calls.push('before16'); },
                                                                                            success: function() { calls.push('success16'); },
                                                                                            after: function() { calls.push('after16'); }
                                                                                        },
                                                                                        frames: {
                                                                                            '?p8=8': {
                                                                                                render: {
                                                                                                    before: function() { calls.push('before17'); },
                                                                                                    success: function() { calls.push('success17'); },
                                                                                                    after: function() { calls.push('after17'); }
                                                                                                },
                                                                                                frames: {
                                                                                                    '?p9=9': {
                                                                                                        render: {
                                                                                                            before: function() { calls.push('before18'); },
                                                                                                            success: function() { calls.push('success18'); },
                                                                                                            after: function() { calls.push('after18'); }
                                                                                                        }
                                                                                                    }
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            })
            .run({callTemplate: testCallTemplate});

        $CR.set('/a/b/c/d/e/f/g/h?p1=1&p2=2&p3=3&p4=4&p5=5&p6=6&p7=7&p8=8&p9=9');

        waitInit();
        wait();

        runs(function() {
            expect(calls).toEqual([
                'before1',
                'before2',
                'before3',
                'success1',
                'after1',
                'success2',
                'after2',
                'success3',
                'after3',
                'before4',
                'success4',
                'after4',
                'before5',
                'success5',
                'after5',
                'before6',
                'before7',
                'before8',
                'before9',
                'before10',
                'before13',
                'before16',
                'before17',
                'before18',
                'before11',
                'before12',
                'success6',
                'after6',
                'success7',
                'after7',
                'success8',
                'after8',
                'success9',
                'after9',
                'success10',
                'after10',
                'success11',
                'after11',
                'success12',
                'after12',
                'success16',
                'after16',
                'success17',
                'after17',
                'success18',
                'after18',
                'success13',
                'after13',
                'before14',
                'success14',
                'after14',
                'before15',
                'success15',
                'after15'
            ]);
        });
    });
});
