const fs=require('node:fs'),crypto=require('node:crypto');
const file='/app/apps/api/dist/modules/admin-observability/admin-observability.module.js';
const base=fs.readFileSync(file,'utf8');
if(crypto.createHash('sha256').update(base).digest('hex')!=='303bffda01179a6a7986e08078bae5c7d7d0c0713524243169e012cb7f9783db')throw Error('Unexpected observability module');
const anchor="require('./binary-map.controller').BinaryMapController]";
if(base.split(anchor).length!==2)throw Error('Unexpected binary-map registration');
fs.writeFileSync(file,base.replace(anchor,"require('./binary-map.controller').BinaryMapController,require('./sponsor-map.controller').SponsorMapController]"));
