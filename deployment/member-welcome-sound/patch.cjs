'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2],indexFile=path.join(root,'index.html'),index=fs.readFileSync(indexFile,'utf8');
const current=index.match(/<script type="module" crossorigin src="(\/assets\/[^"]+\.js)"/)[1],next=current.replace('.js','-sound.js');
function replace(text,old,value){if(text.split(old).length!==2)throw Error('Unexpected production member bundle: '+old);return text.replace(old,()=>value);}
let bundle=fs.readFileSync(path.join(root,current),'utf8');
bundle=replace(bundle,'memberNoStatus:a}=Ml();v0(s==null?', 'memberNoStatus:a}=Ml();h.useEffect(()=>{if(!e&&!n)enterMemberCenter(Ze.isInClient())},[e,n]);v0(s==null?');
bundle=replace(bundle,'r.jsx(kj,{}),r.jsx("uc-season-picker",{})','r.jsx(kj,{}),r.jsx("uc-welcome-sound",{}),r.jsx("uc-season-picker",{})');
fs.writeFileSync(path.join(root,next),'import {enterMemberCenter} from "/welcome-sound/welcome.js";\n'+bundle);
fs.writeFileSync(indexFile,replace(replace(index,current,next),'</head>','<link rel="stylesheet" href="/welcome-sound/style.css"></head>'));
