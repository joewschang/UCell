const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.argv[2],index=path.join(root,'index.html');let html=fs.readFileSync(index,'utf8');
const asset=html.match(/type="module" crossorigin src="([^"]+)"/)[1];let js=fs.readFileSync(path.join(root,asset),'utf8');
function replace(a,b){if(js.split(a).length!==2)throw Error('Unexpected birthday insertion point: '+a);js=js.replace(a,b)}
replace('if(!e&&!n)enterMemberCenter(Ze.isInClient())','if(!e&&!n){const inside=Ze.isInClient();birthdayCheck().then(active=>{if(!active)enterMemberCenter(inside)})}');
replace('className:"hero uc-home-greeting",children:[r.jsxs("div",{children:[','className:"hero uc-home-greeting",children:[r.jsxs("div",{children:[r.jsx("uc-birthday-wish",{}),');
replace('className:"uc-welcome",children:[','className:"uc-welcome",children:[r.jsx("uc-birthday-wish",{}),');
js='import {check as birthdayCheck} from "/birthday/v1/entry.js";\n'+js;
const next='/assets/member-birthday-'+crypto.createHash('sha256').update(js).digest('hex').slice(0,16)+'.js';
fs.writeFileSync(path.join(root,next),js);
fs.writeFileSync(index,html.replace(asset,next).replace('</head>','<link rel="stylesheet" href="/birthday/v1/birthday.css"></head>'));
