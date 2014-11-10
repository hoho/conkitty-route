'use strict';

var gulp = require('gulp');

var eslint = require('gulp-eslint');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');

var path = require('path');
var fs = require('fs');


gulp.task('eslint', function() {
    return gulp.src(['gulpfile.js', 'croute.js'])
        .pipe(eslint({
            rules: {
                'quotes': [2, 'single'],
                'no-shadow-restricted-names': 0,
                'no-underscore-dangle': 0,
                'no-use-before-define': [2, 'nofunc'],
                'no-new': 0,
                'new-cap': 0,
                'no-multi-spaces': 0,
                'comma-spacing': 0
            },
            env: {
                'node': true,
                'browser': true
            }
        }))
        .pipe(eslint.format());
});


gulp.task('uglify', function() {
    return gulp.src(['croute.js'])
        .pipe(uglify({preserveComments: 'some'}))
        .pipe(rename('croute.min.js'))
        .pipe(gulp.dest('.'));
});


gulp.task('assert-version', function(err) {
    var assertVersion = require('assert-version');

    err(assertVersion({
        'croute.js': '',
        'bower.json': ''
    }));
});


gulp.task('test', function(done) {
    var karma = require('karma').server;
    var tests = fs.readdirSync('test');
    var commons = ['node_modules/histery/histery.js', 'croute.js', 'test/common.js'];
    var pending = [];


    tests.forEach(function(file) {
        if (!/\.test\.js$/.test(file)) { return; }

        pending.push(function() {
            karma.start({
                configFile: path.join(__dirname, 'karma.conf.js'),
                files: commons.concat(path.join('test', file)),
                singleRun: true
            }, nextTest);
        });
    });

    nextTest();

    function nextTest() {
        var next = pending.shift();
        if (next) { next(); }
        else { done(); }
    }
});


gulp.task('default', ['eslint', 'uglify', 'assert-version', 'test']);
