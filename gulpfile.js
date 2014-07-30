'use strict';

var gulp = require('gulp');

var eslint = require('gulp-eslint');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');
var conkitty = require('gulp-conkitty');
var concat = require('gulp-concat');


gulp.task('eslint', function() {
    return gulp.src(['gulpfile.js', 'croute.js'])
        .pipe(eslint({
            rules: {
                'quotes': [2, 'single'],
                'no-shadow-restricted-names': 0,
                'no-underscore-dangle': 0,
                'no-use-before-define': [2, 'nofunc'],
                'no-new': 0
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


gulp.task('templates', function() {
    return gulp.src('./test/*.ctpl')
        .pipe(conkitty({
            common: 'common.js',
            templates: 'tpl.js'
        }))
        .pipe(concat('js.js'))
        .pipe(gulp.dest('tmp'));
});


gulp.task('serve', ['templates'], function() {
    var http = require('http');
    var fs = require('fs');

    var routes = {
            '/qunit.css': 'node_modules/qunitjs/qunit/qunit.css',
            '/qunit.js': 'node_modules/qunitjs/qunit/qunit.js',
            '/histery.js': require.resolve('histery'),
            '/tpl.js': 'tmp/js.js',
            '/croute.js': 'croute.js',
            '/croute.min.js': 'croute.min.js',
            '/test.js': 'test/test.js',
            '/test': 'test/test.html'
        };

    var _server = http.createServer(function serve(req, res) {
        if (req.url.substring(0, 5) === '/api/') {
            setTimeout(function() {
                res.end(JSON.stringify({some: 'data', rnd: Math.random(), url: req.url}));
            }, 1000);
        } else {
            var file = routes[req.url];
            fs.createReadStream(file || 'test/tmp.html').pipe(res);
        }
    }).listen(3000, 'localhost');

    _server.on('close', function() { console.log('Stopped server'); });

    console.log('Listening on port 3000');
});


gulp.task('default', ['eslint', 'uglify']);
