const fs=require('fs'),assert=require('assert/strict'),p='/app/apps/api/dist/modules/content/content.service.js';
const s=fs.readFileSync(p,'utf8'),a=s.indexOf('async adminList('),b=s.indexOf('async ',a+6);assert(a>=0&&b>a);
const body=s.slice(a,b),updated=body.replace(/,\s*take:\s*100\b/,'');assert.notEqual(body,updated,body);
fs.writeFileSync(p,s.slice(0,a)+updated+s.slice(b));
