/*

  gulpfile.js - gulp script for building Faker package for browser / stand-alone package
  run this file using the gulp command

  If this is your first time trying to build faker, you will need to install gulp:

    cd faker.js/
    [sudo] npm install
    [sudo] npm install gulp -g
    cd build/
    gulp

*/

const path = require('path');
const fs = require('fs');
const through = require('through2')
const gulp = require('gulp');
const jsdoc = require('gulp-jsdoc3');
const uglify = require('gulp-uglify');
const rename = require('gulp-rename');
const ghPages = require('gulp-gh-pages');
const mustache = require('gulp-mustache');
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const streamify = require('gulp-streamify');

gulp.task('browser-package', function() {

  /* task for building browser bundles using browserify

     this task will generate the following files:
      ./build/build/faker.js
      ./build/build/faker.min.js
      ./examples/browser/js/faker.js
      ./examples/browser/js/faker.min.js

  */

 // use browserify to create UMD stand-alone browser package
  const bundleStream = browserify('./index.js', {standalone: 'faker'}).bundle();

  return bundleStream
    .pipe(source('./index.js'))
    .pipe(rename('faker.js'))
    .pipe(gulp.dest('build/'))
    .pipe(gulp.dest('./examples/browser/js'))
    .pipe(rename({ extname: '.min.js' }))
    .pipe(streamify(uglify()))
    .pipe(gulp.dest('build/'))
    .pipe(gulp.dest('./examples/browser/js'))
    .pipe(rename('./examples/browser/js/faker.min.js'));
});

// pushes jsdoc changes to gh-pages branch
gulp.task('gh-pages', function() {
  return gulp.src('./doc/**/*')
     .pipe(ghPages());
});

gulp.task('jsdoc', function (cb) {
    const config = require('./conf.json');
    gulp.src(['./README.md', './lib/*.js'], {read: false})
        .pipe(jsdoc(config, cb));
});

// builds Readme.md file from docs.md and exported faker methods
gulp.task('documentation', function(cb) {

  /* task for generating documentation
     this task will generate the following file:
      ../Readme.md
  */

  let API = '', LOCALES = '';
  const faker = require('.');

  // generate locale list
  for (const locale in faker.locales) {
    LOCALES += ` * ${locale}\n`;
  }

  let keys = Object.keys(faker).sort();

  // generate nice tree of api for docs
  keys.forEach(function(_module){
    // ignore certain properties
    const ignore = ['locale', 'localeFallback', 'definitions', 'locales'];
    if (ignore.includes(_module)) return;

    API += `* ${_module}\n`;
    for (const method in faker[_module]) {
      API += `  * ${method}\n`;
    }
  });

  return gulp.src('./build/src/docs.md')
    .pipe(mustache({
       'API': API,
       'LOCALES': LOCALES,
       'startYear': 2010,
       'currentYear': new Date().getFullYear()
     }))
    .pipe(rename('./build/Readme.md'))
    .pipe(gulp.dest('./build'))

});

const tasks = ['documentation', 'jsdoc', 'nodeLocalRequires', 'browser-package', 'gh-pages'];

const locales = require('./lib/locales');
const localTasks = Object.keys(locales);

/* task for generating unique browser builds for every locale */
Object.keys(locales).forEach(function(locale, i) {
   if (i > 0) {
     // return;
   }
   const localTaskName = `generate-locale-${locale}`
   tasks.push(localTaskName);
   gulp.task(localTaskName, function() {
    const bundleStream = browserify('./index.js', {standalone: 'faker'}).bundle();

    return bundleStream
      .pipe(source(`./locale/${locale}.js`))
      .pipe(rename(`faker.${locale}.js`))
      .pipe(gulp.dest(`./build/build/locales/${locale}`))
      .pipe(gulp.dest(`./examples/browser/locales/${locale}/`))
      .pipe(rename({ extname: '.min.js' }))
      .pipe(streamify(uglify()))
      .pipe(gulp.dest(`./build/build/locales/${locale}`))
      .pipe(gulp.dest(`./examples/browser/locales/${locale}/`))
      .pipe(rename(`./examples/browser/locales/${locale}/faker.${locale}min.js`));
   });
});

gulp.task('nodeLocalRequires', function (cb){
  const locales = require('./lib/locales');
  for (const locale in locales) {
    const localeFile = path.normalize(`${__dirname}/locale/${locale}.js`);
    const localeRequire = `var Faker = require('../lib');
var faker = new Faker({ locale: '${locale}', localeFallback: 'en' });
faker.locales['${locale}'] = require('../lib/locales/${locale}');
faker.locales['en'] = require('../lib/locales/en');
module['exports'] = faker;
`;
    // TODO: better fallback support
    fs.writeFileSync(localeFile, localeRequire);
  }
  cb();
});

gulp.task('local', gulp.series(tasks.filter(name => name !== 'gh-pages')));
gulp.task('default', gulp.series(tasks));
