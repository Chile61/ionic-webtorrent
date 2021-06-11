const fs = require('fs');
const f = 'node_modules/@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs/browser.js';

fs.readFile(f, 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  var result = data.replace(/node: false/g, 'node: {crypto: true, stream: true}');

  fs.writeFile(f, result, 'utf8', function (err) {
    if (err) return console.log(err);
  });
});

// Copy Android.json
fs.copyFile("patch\\Android.json", "platforms\\android\\Android.json", (err) => {
  if (err) throw err;
  console.log('Android.json was copied to destination');
});

// Copy AndroidManifest.xml
fs.copyFile("patch\\AndroidManifest.xml", "platforms\\android\\app\\src\\main\\AndroidManifest.xml", (err) => {
  if (err) throw err;
  console.log('AndroidManifest.xml was copied to destination');
});

// Copy build-extras.gradle
fs.copyFile("patch\\build-extras.gradle", "platforms\\android\\app\\build-extras.gradle", (err) => {
  if (err) throw err;
  console.log('build-extras.gradle was copied to destination');
});
