'use strict';
const themes=['classic','christmas','newyear','lunar'];
const host='https://api.line.me/v2/bot';
async function line(path,method='GET',opts={}){
 const res=await fetch((opts.host||host)+path,{method,headers:{Authorization:'Bearer '+process.env.LINE_CHANNEL_ACCESS_TOKEN,...opts.headers},body:opts.body,signal:AbortSignal.timeout(opts.timeout||4000)});
 if(res.status===404 && opts.missing)return null;
 if(!res.ok)throw Error('LINE '+res.status);
 if(opts.bytes)return Buffer.from(await res.arrayBuffer()); const raw=await res.text();return raw?JSON.parse(raw):{};
}
const current=(user,request)=>request('/user/'+encodeURIComponent(user)+'/richmenu','GET',{missing:true}).then(x=>x?.richMenuId||null);
async function applyMenu(user,desired,previous,known,request=line){
 const path='/user/'+encodeURIComponent(user)+'/richmenu',before=await current(user,request);
 if(desired && before!==desired)await request(path+'/'+desired,'POST');
 if(!desired && known.includes(before)){
   if(previous && await request('/richmenu/'+previous,'GET',{missing:true}))await request(path+'/'+previous,'POST');
   else await request(path,'DELETE');
 }
 const after=await current(user,request);
 if(desired?after!==desired:known.includes(after))throw Error('LINE link not confirmed');
}
async function links(db,id){return db.identityLink.findMany({where:{personId:id,provider:'LINE',status:'ACTIVE',revokedAt:null},select:{providerSubject:true,identityLinkId:true}})}
async function state(db,id){
 const prefs=await db.$queryRawUnsafe('select theme from identity.member_season_preference where person_id=$1::uuid',id);
 const theme=prefs[0]?.theme||'classic',active=await links(db,id);
 const bindings=await db.$queryRawUnsafe('select identity_link_id::text as id, applied from identity.member_season_binding where person_id=$1::uuid',id);
 const needsSync=active.some(x=>{const b=bindings.find(b=>b.id===x.identityLinkId);return theme==='classic'?!!b:b?.applied!==theme});
 return {theme,lineState:active.length?(needsSync?'pending':theme==='classic'?'default':'synced'):'unlinked',needsSync};
}
async function change(db,id,theme){
 return db.$transaction(async tx=>{
 await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 3720))',id);
 if(theme)await tx.$executeRawUnsafe('insert into identity.member_season_preference(person_id,theme) values($1::uuid,$2) on conflict(person_id) do update set theme=excluded.theme',id,theme);
 const choice=(await state(tx,id)).theme;
 const catalog=await tx.$queryRawUnsafe('select theme,menu_id from identity.member_season_menus');
 const known=catalog.map(x=>x.menu_id),target=catalog.find(x=>x.theme===choice)?.menu_id;
 for(const x of await links(tx,id)){
 const bid=x.identityLinkId,user=x.providerSubject;
 let [b]=await tx.$queryRawUnsafe('select previous_menu_id,applied from identity.member_season_binding where identity_link_id=$1::uuid and person_id=$2::uuid',bid,id);
 if(choice==='classic'&&!b)continue;
 try{
 if(choice!=='classic'&&!target)continue;
 if(!b){
 const was=await current(user,line);
 b={previous_menu_id:known.includes(was)?null:was};
 await tx.$executeRawUnsafe('insert into identity.member_season_binding(person_id,identity_link_id,previous_menu_id) values ($1::uuid,$2::uuid,$3) on conflict(identity_link_id) do update set person_id=excluded.person_id, previous_menu_id=excluded.previous_menu_id, applied=null',id,bid,b.previous_menu_id);
 }
 await applyMenu(user,target,b.previous_menu_id,known);
 if(choice==='classic')await tx.$executeRawUnsafe('delete from identity.member_season_binding where person_id=$1::uuid and identity_link_id=$2::uuid',id,bid);
 else await tx.$executeRawUnsafe('update identity.member_season_binding set applied=$3 where person_id=$1::uuid and identity_link_id=$2::uuid',id,bid,choice);
 }catch(e){if(b)await tx.$executeRawUnsafe('update identity.member_season_binding set applied=null where person_id=$1::uuid and identity_link_id=$2::uuid',id,bid);}
 }
 return state(tx,id);
 },{maxWait:8000,timeout:45000});
}
function register(C){
 const {Get,Post,Req,Body,Header,BadRequestException,UnauthorizedException}=require('@nestjs/common'),p=C.prototype;
 for(const [name,method] of [['seasonRead',Get],['seasonWrite',Post]]){
 if(p[name])throw Error('Duplicate seasonal route');
 p[name]=function(req,body){const id=req.user?.personId;if(!id)throw new UnauthorizedException();
 if(name==='seasonRead')return state(this.service.db,id);
 if(!body||!(themes.includes(body.theme)||body.sync===true&&body.theme===undefined))throw new BadRequestException('無此主題');
 return change(this.service.db,id,body.theme);};
 const d=Object.getOwnPropertyDescriptor(p,name); Req()(p,name,0);if(name==='seasonWrite')Body()(p,name,1);
 Header('Cache-Control','private, no-store')(p,name,d);method('season-theme')(p,name,d);
 }
}
module.exports={themes,line,state,change,applyMenu,register};
