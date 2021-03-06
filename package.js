const process = require('process');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const mkdirp = require('mkdirp');
const os = require('os');

// const createDMG = require('electron-installer-dmg')

var appDir;
var appId;
var runtimeId;
var assets;
for (var arg of process.argv) {
  if (arg.startsWith('--app-id=')) {
    appId = arg.substring('--app-id='.length)
  }
  else if (arg.startsWith('--app-dir=')) {
    appDir = arg.substring('--app-dir='.length)
  }
  else if (arg.startsWith('--runtime-id=')) {
    runtimeId = arg.substring('--runtime-id='.length)
  }
  else if (arg.startsWith('--assets=')) {
    assets = arg.substring('--assets='.length)
  }
}

if (!runtimeId) {
  console.warn('missing --runtime-id')
  console.warn('Chrome runtime will only be updated with full electron upgrades.')
}

if (!appDir) {
  console.error('missing --app-dir argument');
  console.error('example: --app-dir=/path/to/chrome/app')
  process.exit(-1);
}

var manifest = JSON.parse(fs.readFileSync(path.join(appDir, 'manifest.json')).toString());
var chrome;
try {
  chrome = JSON.parse(fs.readFileSync(path.join(appDir, 'electron.json')).toString());
}
catch (e) {
}

function withAppId() {
  var packager = require('electron-packager')
  var out = path.join(__dirname, 'build');
  packager({
    dir: __dirname,
    out: out,
    platform: 'darwin',
    arch: 'all',
    'osx-sign': true,
    name: manifest.name,
    'app-version': manifest.version,

    overwrite: true,
    // all: true,
    afterCopy: [function(buildPath, electronVersion, platform, arch, callback) {
      var ncp = require('ncp').ncp;

      console.log(appDir, buildPath);

      var electronJson = path.join(buildPath, 'package.json');
      var electronPackage = JSON.parse(fs.readFileSync(electronJson).toString());
      electronPackage.name = manifest.name;
      electronPackage.description = manifest.description;
      electronPackage.version = manifest.version;
      chrome = chrome || {};
      chrome.runtimeId = chrome.runtimeId || runtimeId;
      chrome.appId = chrome.appId || appId;
      electronPackage.chrome = chrome;
      fs.writeFileSync(electronJson, JSON.stringify(electronPackage, null, 2));

      console.log('copying app into place');
      ncp(appDir, path.join(buildPath, 'unpacked-crx'), {
        clobber: false,
        dereference: true,
      },
      function (err) {
        if (err) {
          console.error(err);
          process.exit(-1);
        }
        console.log('app copied into place');
        if (!assets) {
          callback();
          return;
        }

        console.log('copying platform-assets into place for', os.platform());
        var platformAssets = path.join(assets, os.platform());
        var platformAssetsDest = path.join(buildPath, 'platform-assets', os.platform());
        mkdirp.sync(platformAssetsDest);
        ncp(platformAssets, platformAssetsDest, {
          clobber: false,
          dereference: true,
        }, function(err) {
          if (err) {
            console.error(err);
            process.exit(-1);
          }
          console.log('platform-assets copied into place');
          callback();
        })
      });
    }]
  }, function (err, appPaths) {
    // var icon = path.join(appDir, manifest.icons['128']);
    // console.log(icon);
    appPaths
    .filter(appPath => appPath.indexOf('darwin') != -1)
    .forEach(appPath => {

      // var zip = new AdmZip();
      // zip.addLocalFolder(path.join(appPath, manifest.name + '.app'), path.basename(appPath));
      // console.log('writing zip');
      // zip.writeZip(path.join(appPath, manifest.name + '.zip'));
      // console.log('done writing zip');

      // createDMG({
      //   out: appPath,
      //   overwrite: true,
      //   name: manifest.name,
      //   appPath: path.join(appPath, manifest.name + '.app'),
      //   icon: icon,
      // }, function done (err) {
      //   if (err)
      //     console.error('dmg error', err);
      //   else
      //     console.log('done packaging .dmg')
      // })
    })
  })
}

function needAppId() {
  console.error('missing --app-id argument');
  console.error('example: --app-id=gidgenkbbabolejbgbpnhbimgjbffefm')
  process.exit(-1);
}


if (!appId) {
  if (!manifest.key) {
    needAppId();
    return;
  }
  require('./chrome/main/chrome-app-id.js').calculateId(manifest.key)
  .then(id => {
    appId = id;
    withAppId();
  })
  .catch(() => {
    needAppId();
  })
}
else {
  withAppId();
}
