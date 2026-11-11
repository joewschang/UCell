'use strict';
const fs=require('node:fs'),path=require('node:path'),{line,themes}=require('./season.cjs');
const dbSchema=[
 "create table if not exists identity.member_season_preference(person_id uuid primary key references identity.person(person_id),theme text not null check(theme in ('classic','christmas','newyear','lunar')))",
 "create table if not exists identity.member_season_menus(theme text primary key,menu_id text not null unique)",
 "create table if not exists identity.member_season_binding(identity_link_id uuid primary key references identity.identity_link(identity_link_id),person_id uuid not null references identity.person(person_id), previous_menu_id text,applied text)",
 "create index if not exists ix_member_season_binding_person on identity.member_season_binding(person_id)"
];
exports.run=async()=>{
 const {PrismaClient}=require('@prisma/client'),db=new PrismaClient();
 try{
 const info=await line('/info');if(info.basicId!=='@258vmvsa')throw Error('Unexpected OA');
 const {richMenuId:original}=await line('/user/all/richmenu'),base=await line('/richmenu/'+original),expected=['','events','shop','faq'];
 if(base.size.width!==1280||base.size.height!==864||base.areas.length!==4||!base.areas.every((a,i)=>a.action.uri==='https://liff.line.me/2012021712-Dqh6Z8aq/'+expected[i]&&a.bounds.x===i%2*640&&a.bounds.y===(i<2?0:392)&&a.bounds.width===640&&a.bounds.height===(i<2?392:398)))throw Error('Default layout changed');
 for(const q of dbSchema)await db.$executeRawUnsafe(q);
 const {richmenus}=await line('/richmenu/list'),ids={};
 for(const theme of themes.slice(1)){
 const name='UCell Seasonal 20261111 '+theme,spec={name,selected:base.selected,size:base.size,areas:base.areas,chatBarText:base.chatBarText};
 let found=richmenus.find(x=>x.name===name);if(found&&JSON.stringify(found.areas)!==JSON.stringify(base.areas))throw Error('Menu definition changed');
 const id=found?.richMenuId||(await line('/richmenu','POST',{headers:{'Content-Type':'application/json'},body:JSON.stringify(spec)})).richMenuId;
 const content='/richmenu/'+id+'/content',bytes=fs.readFileSync(path.join(__dirname,'art','menu-'+theme+'.jpg')),host='https://api-data.line.me/v2/bot';
 let remote=await line(content,'GET',{host,bytes:true,missing:true});if(!remote){await line(content,'POST',{host,headers:{'Content-Type':'image/jpeg'},body:bytes,timeout:15000});remote=await line(content,'GET',{host,bytes:true});}
 if(!remote.equals(bytes))throw Error('Menu image mismatch '+theme);
 await db.$executeRawUnsafe('insert into identity.member_season_menus(theme,menu_id) values ($1,$2) on conflict(theme) do update set menu_id=excluded.menu_id',theme,id);
 ids[theme]=id;
 }
 if((await line('/user/all/richmenu')).richMenuId!==original)throw Error('OA default changed');
 return {ids,defaultUnchanged:true};
 }finally{await db.$disconnect();}
};
