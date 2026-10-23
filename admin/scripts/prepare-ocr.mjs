import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),req=createRequire(path.join(root,'package.json')),out=path.join(root,'public/ocr');fs.mkdirSync(out,{recursive:true});
fs.copyFileSync(req.resolve('tesseract.js/dist/worker.min.js'),path.join(out,'worker.min.js'));
const core=path.dirname(createRequire(req.resolve('tesseract.js/package.json')).resolve('tesseract.js-core/package.json'));
for(const name of fs.readdirSync(core).filter(n=>/\.wasm(\.js)?$/.test(n)))fs.copyFileSync(path.join(core,name),path.join(out,name));
for(const lang of ['eng','chi_tra'])if(!fs.existsSync(path.join(out,lang+'.traineddata')))throw Error('Missing bundled OCR language: '+lang);
