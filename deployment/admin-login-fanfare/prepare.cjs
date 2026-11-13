'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const {prepare} = require('../third-placement/site/prepare.cjs');

const [original, output] = process.argv.slice(2);
const admin = path.resolve(__dirname, '../../admin');
const adminRequire = createRequire(path.join(admin, 'package.json'));
const viteRequire = createRequire(adminRequire.resolve('vite/package.json'));
const esbuild = viteRequire('esbuild');

const controller = esbuild.buildSync({
  entryPoints: [path.join(admin, 'src/features/auth/loginFanfare.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'ucellAdminLoginFanfare',
  target: 'es2020',
  minify: true,
  write: false
}).outputFiles[0].text;

prepare('admin', original, output, {
  image: '45f206ca0c2a2c3f694277347bb4ded1ad09e661e95d32dcad406785ae7f4e1d',
  html: 'd68a4960d34d6b87b91311aea5c655625085eb79ba8078ce1c3bc1e3e1f76270',
  entry: 'admin-workflows-daa107f787ed3819.js',
  entryHash: '02a7166ee58f6b14588ec1bfca2bb07bb8aecf1ffbe6a442498a405a3dfe3379',
  edits: [
    ['i(R),Fp(R),l(!0);return', 'i(R),Fp(R),l(!0),ucellAdminLoginFanfare.playLoginFanfare(A);return'],
    ['function p(){t.clear(),K6(),Fp(null),i(null)}',
      'function p(){ucellAdminLoginFanfare.stopLoginFanfare(),t.clear(),K6(),Fp(null),i(null)}'],
    ['logout:async()=>{u(!0);try{sessionStorage.getItem("ucell_admin_token")',
      'logout:async()=>{ucellAdminLoginFanfare.stopLoginFanfare(),u(!0);try{sessionStorage.getItem("ucell_admin_token")']
  ],
  transform: code => controller + '\n' + code
}, 'login-fanfare');

const audioDirectory = path.join(output, 'overlay/assets/audio');
fs.mkdirSync(audioDirectory, {recursive: true});
for (const filename of ['admin_login_triumphant_fanfare.mp3', 'admin-login-fanfare.css']) {
  fs.copyFileSync(path.join(admin, 'public/assets/audio', filename), path.join(audioDirectory, filename));
}

const manifestFile = path.join(output, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const priorStylesheet = '<link rel="stylesheet" href="/assets/time-sort-87e451e5ca826c8b.css">';
assert.equal(fs.readFileSync(path.join(original, 'index.html'), 'utf8').split(priorStylesheet).length, 2);
manifest.replacements[priorStylesheet] = priorStylesheet + '<link rel="stylesheet" href="/assets/audio/admin-login-fanfare.css">';
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
