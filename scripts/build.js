var Rsync = require('rsync');
var rimraf = require('rimraf');
var zipFolder = require('zip-dir');
var mkdirp = require('mkdirp');


rimraf('./dist', function(err) {
  if (err) {
    console.log("err: " + err);
  } else {
    //make it again
    mkdirp('./dist', function(err) {
      if (err) {
        console.log("err: " + err);
      } else {

        var rsync = new Rsync()
          .source('.')
          .destination('dist')
          .exclude(['dist', 'release-candidate.zip', 'node_modules', '.ebignore', 'server/staging', '.elasticbeanstalk', '.jsbeautifyrc', '.gitignore', '.git', 'scripts'])
          .flags('a') //archive mode
          .execute(function(err, stdout, stderr) {

            zipFolder('dist', { saveTo: 'release-candidate.zip' }, function(err) {
              if (err) {
                console.log("err: " + err);
              } else {
                console.log("build finished.")
              }
            });
          });
      }
    });
  }
});
