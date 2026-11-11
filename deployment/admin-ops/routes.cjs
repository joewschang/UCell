const fs=require('node:fs');
const file=process.argv[2];
const original=fs.readFileSync(file,'utf8');
const anchor='  location / {';
if(original.split(anchor).length!==2 || original.includes('location = /products ')) throw Error('Unexpected admin Nginx routes');
const routes=[
  '  # The product catalogue and its image directory share a path.',
  '  location = /products { rewrite ^ /index.html last; }',
  '  location = /products/ { rewrite ^ /index.html last; }',
  '',
  anchor
].join('\n');
let config=original.replace(anchor,routes);
if(!config.includes('absolute_redirect off;')) {
  if(config.split('server {').length!==2) throw Error('Expected one admin server');
  config=config.replace('server {','server {\n  absolute_redirect off;');
}
fs.writeFileSync(file,config);
