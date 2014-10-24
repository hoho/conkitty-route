'use strict';

var gulp = require('gulp');

var eslint = require('gulp-eslint');
var concat = require('gulp-concat');
var conkitty = require('gulp-conkitty');

var del = require('del');

var devServe = require('devserve');

var BUILD_DIR = 'build';

gulp.task('clean', function(cb) {
    del(BUILD_DIR, cb);
});


gulp.task('eslint', function() {
    var rules = {
        'quotes': [2, 'single'],
        'no-shadow-restricted-names': 0,
        'no-underscore-dangle': 0,
        'no-use-before-define': [2, 'nofunc'],
        'no-fallthrough': 0
    };

    gulp.src(['gulpfile.js'])
        .pipe(eslint({rules: rules, env: {node: true}}))
        .pipe(eslint.format());

    gulp.src(['src/**/*.js'])
        .pipe(eslint({rules: rules, env: {browser: true}}))
        .pipe(eslint.format());
});


gulp.task('deps', function() {
    return gulp.src([
        require.resolve('histery'),
        require.resolve('../..')
    ]).pipe(gulp.dest(BUILD_DIR));
});


gulp.task('templates', function() {
    return gulp.src('src/**/*.ctpl')
        .pipe(conkitty({common: 'common.js', templates: 'tpl.js'}))
        .pipe(concat('templates.js'))
        .pipe(gulp.dest(BUILD_DIR));
});


gulp.task('app', function() {
    return gulp.src(['src/index.html', 'src/routes.js', 'src/style.css'])
        .pipe(gulp.dest(BUILD_DIR));
});


gulp.task('build', ['deps', 'templates', 'app']);


gulp.task('serve', ['build'], function() {
    var url = require('url');

    var demoData = {
        'Inbox': {
            '0000000001': {subject: 'Hello world 0000000001', text: Math.random() + ''},
            '0000000002': {subject: 'Hello world 0000000002', text: Math.random() + ''},
            '0000000003': {subject: 'Hello world 0000000003', text: Math.random() + ''}
        },
        'Folder1': {
            '1000000001': {subject: 'Hello world 1000000001', text: Math.random() + ''},
            '1000000002': {subject: 'Hello world 1000000002', text: Math.random() + ''},
            '1000000003': {subject: 'Hello world 1000000003', text: Math.random() + ''},
            '1000000004': {subject: 'Hello world 1000000004', text: Math.random() + ''},
            '1000000005': {subject: 'Hello world 1000000005', text: Math.random() + ''}
        },
        'Folder2': {
            '2000000001': {subject: 'Hello world 2000000001', text: Math.random() + ''},
            '2000000002': {subject: 'Hello world 2000000002', text: Math.random() + ''},
            '2000000003': {subject: 'Hello world 2000000003', text: Math.random() + ''},
            '2000000004': {subject: 'Hello world 2000000004', text: Math.random() + ''},
            '2000000005': {subject: 'Hello world 2000000005', text: Math.random() + ''}
        },
        'Folder3': {
            '3000000001': {subject: 'Hello world 3000000005', text: Math.random() + ''}
        },
        'Folder4': {},
        'Folder5': {
            '5000000001': {subject: 'Hello world 5000000005', text: Math.random() + ''}
        }

    };

    gulp.watch('src/*', ['build']);

    devServe({
        '/': {file: 'index.html'},
        '/api/': {
            callback: function(request, response) {
                var parsed = url.parse(request.url, true),
                    ret,
                    folder,
                    message;

                switch (parsed.pathname) {
                    case '/api/folders':
                        ret = Object.keys(demoData);
                        break;

                    case '/api/messages':
                        if (((folder = parsed.query.folder)) && ((folder = demoData[folder]))) {
                            ret = Object.keys(folder).map(function(item) {
                                return {id: item, subject: folder[item].subject};
                            });
                            break;
                        }

                    case '/api/message':
                        if (((folder = parsed.query.folder)) &&
                            ((message = parsed.query.message)) &&
                            ((folder = demoData[folder])) &&
                            ((message = folder[message])))
                        {
                            ret = message;
                            break;
                        }

                    default:
                        response.statusCode = 404;
                        ret = {error: true};
                }

                response.setHeader('Content-Type', 'application/json');
                setTimeout(function() {
                    response.end(JSON.stringify(ret));
                }, 500);
            }
        },
        '/_/': {dir: '.'}
    }, 'build', 3001);
});


gulp.task('default', ['eslint', 'serve']);
