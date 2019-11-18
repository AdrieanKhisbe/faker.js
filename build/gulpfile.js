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

const gulp = require('gulp');
const jsdoc = require('gulp-jsdoc3');
const uglify = require('gulp-uglify');
const rename = require('gulp-rename');
const ghPages = require('gulp-gh-pages');
const mustache = require('gulp-mustache');
const browserify = require('browserify');
const transform = require('vinyl-transform');
const path = require('path');
const fs = require('fs');
const through = require('through2')

gulp.task('browser-package', function() {

  /* task for building browser bundles using browserify

     this task will generate the following files:
      ./build/faker.js
      ./build/faker.min.js
      ../examples/browser/js/faker.js
      ../examples/browser/js/faker.min.js

  */

  const browserified = transform(function(filename) {
    // use browserify to create UMD stand-alone browser package
    return browserify(filename, {
      standalone: 'faker'
    }).bundle();
  });

  return gulp.src('../index.js')
    .pipe(browserified)
    .pipe(rename('faker.js'))
    .pipe(gulp.dest('build/'))
    .pipe(gulp.dest('../examples/browser/js'))
    .pipe(rename({ extname: '.min.js' }))
    .pipe(uglify())
    .pipe(gulp.dest('build/'))
    .pipe(gulp.dest('../examples/browser/js'))
    .pipe(rename('../examples/browser/js/faker.min.js'));
});

// pushes jsdoc changes to gh-pages branch
gulp.task('gh-pages', function(cb) {
  return gulp.src('../doc/**/*')
     .pipe(ghPages());
});

gulp.task('jsdoc', function (cb) {
    const config = require('../conf.json');
    gulp.src(['../README.md', '../lib/*.js'], {read: false})
        .pipe(jsdoc(config, cb));
});

// builds Readme.md file from docs.md and exported faker methods
gulp.task('documentation', function(cb) {

  /* task for generating documentation
     this task will generate the following file:
      ../Readme.md
  */

  let API = '', LOCALES = '';
  const faker = require('../index');

  // generate locale list
  for (const locale in faker.locales) {
    LOCALES += ` * ${locale}\n`;
  }

  const keys = Object.keys(faker).sort();

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

  return gulp.src('./src/docs.md')
    .pipe(mustache({
       'API': API,
       'LOCALES': LOCALES,
       'startYear': 2010,
       'currentYear': new Date().getFullYear()
     }))
    .pipe(rename('./Readme.md'))
    .pipe(gulp.dest('../'))

});

const tasks = ['documentation', 'jsdoc', 'nodeLocalRequires', 'browser-package', 'gh-pages'];

const locales = require('../lib/locales');
const localTasks = Object.keys(locales);

/* task for generating unique browser builds for every locale */
Object.keys(locales).forEach(function(locale, i) {
   if (i > 0) {
     // return;
   }
   tasks.push(locale + 'Task');
   gulp.task(locale + 'Task', function() {

    const browserified = transform(function(filename) {
      // use browserify to create UMD stand-alone browser package
      return browserify(filename, {
        standalone: 'faker'
      }).bundle();
    });
    process.chdir('../locale/');
    return gulp.src(`./${locale}.js`)
      .pipe(browserified)
      .pipe(rename(`faker.${locale}.js`))
      .pipe(gulp.dest(`../build/build/locales/${locale}`))
      .pipe(gulp.dest(`../examples/browser/locales/${locale}/`))
      .pipe(rename({ extname: '.min.js' }))
      .pipe(uglify())
      .pipe(gulp.dest(`../build/build/locales/${locale}`))
      .pipe(gulp.dest(`../examples/browser/locales/${locale}/`))
      .pipe(rename(`../examples/browser/locales/${locale}/faker.${locale}min.js`));
   });
});

gulp.task('nodeLocalRequires', function (cb){
  const locales = require('../lib/locales');
  for (const locale in locales) {
    const localeFile = path.normalize(`${__dirname}/../locale/${locale}.js`);
    const localeRequire = `const Faker = require('../lib');
const faker = new Faker({ locale: '${locale}', localeFallback: 'en' });
faker.locales['${locale}'] = require('../lib/locales/${locale}');
faker.locales['en'] = require('../lib/locales/en');

module['exports'] = faker;
`;
    // TODO: better fallback support
    fs.writeFile(localeFile, localeRequire);
  }
  cb();
});


gulp.task('default', gulp.series(tasks));
