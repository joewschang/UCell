'use strict';
const fs=require('node:fs'),path=require('node:path'),{line,themes}=require('./season.cjs');
const sameAreas=(a,b)=>a?.length===b.length && a.every((v,i)=>v.action?.type==='uri' && v.action.uri===b[i].action.uri && ['x','y','width','height'].every(k=>v.bounds[k]===b[i].bounds[k]));
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
  // Touch rows follow the printed dividers; the company footer is not interactive.
 const [split,footer]={christmas:[390,775],lunar:[385,772],newyear:[390,779]}[theme];
 const areas=base.areas.map((a,i)=>({...a,bounds:{x:i%2*640,y:i<2?0:split,width:640,height:i<2?split:footer-split}}));
 const name='UCell Seasonal Art 20261111 '+theme,spec={name,selected:base.selected,size:base.size,areas,chatBarText:base.chatBarText};
 let found=richmenus.find(x=>x.name===name);if(found&&!sameAreas(found.areas,areas))throw Error('Menu definition changed');
 const id=found?.richMenuId||(await line('/richmenu','POST',{headers:{'Content-Type':'application/json'},body:JSON.stringify(spec)})).richMenuId;
 const content='/richmenu/'+id+'/content',bytes=fs.readFileSync(path.join(__dirname,'art','menu-'+theme+'.jpg')),host='https://api-data.line.me/v2/bot';
 let remote=await line(content,'GET',{host,bytes:true,missing:true});if(!remote){await line(content,'POST',{host,headers:{'Content-Type':'image/jpeg'},body:bytes,timeout:15000});remote=await line(content,'GET',{host,bytes:true});}
 if(!remote.equals(bytes))throw Error('Menu image mismatch '+theme);
 const published=await line('/richmenu/'+id);if(!sameAreas(published.areas,areas))throw Error('Published touch areas mismatch: '+theme);
 ids[theme]=id;
 }
 if((await line('/user/all/richmenu')).richMenuId!==original)throw Error('OA default changed');
 const changed=await db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('lock table identity.member_season_menus in access exclusive mode');
  const affected=new Set();
  for(const [theme,id] of Object.entries(ids)){
   const [old]=await tx.$queryRawUnsafe('select menu_id from identity.member_season_menus where theme=$1',theme);
   if(old?.menu_id===id)continue;
   if(old){
    // Retain the old ID as a seasonal menu so restoring classic remains safe even during migration.
    await tx.$executeRawUnsafe('update identity.member_season_menus set theme=$2 where theme=$1',theme,'retired:'+old.menu_id);
    const rows=await tx.$queryRawUnsafe('update identity.member_season_binding set applied=null where applied=$1 returning person_id::text as id',theme);
    rows.forEach(row=>affected.add(row.id));
   }
   await tx.$executeRawUnsafe('insert into identity.member_season_menus(theme,menu_id) values($1,$2)',theme,id);
  }
  return [...affected];
 });
 let pending=0;
 for(const id of changed){const result=await require('./season.cjs').change(db,id);if(result.needsSync)pending++;}
 return {ids,existingMembersUpdated:changed.length-pending,pending,defaultUnchanged:true};
 }finally{await db.$disconnect();}
};
