'use strict';
const {randomUUID,createHash}=require('node:crypto');
const fs=require('node:fs');
const copy=require('./copy.json');
const {line,change}=require('../season/season.cjs');
const graph=require('../modules/auth/microsoft365-mail.service.js');
const mail=new graph.Microsoft365MailService({get:key=>process.env[key]});
const birthdaySQL="to_char(p.birth_date,'MM-DD')=to_char(d.today,'MM-DD') OR (to_char(p.birth_date,'MM-DD')='02-29' AND to_char(d.today,'MM-DD')='02-28' AND extract(day from d.today+1)=1)";
const eligible="p.status='EFFECTIVE' AND p.security_status='NORMAL' AND p.membership_state IS NOT NULL";
const dateFrom="(SELECT (now() AT TIME ZONE 'Asia/Taipei')::date AS today) d";
async function menu(db){
 const existing=await db.$queryRawUnsafe("select menu_id from identity.member_season_menus where theme='birthday'");
 if(existing.length)return;
 const name='UCell Birthday 20261114',info=await line('/info');if(info.basicId!=='@258vmvsa')throw Error('OA mismatch');
 const base=await line('/richmenu/'+(await line('/user/all/richmenu')).richMenuId);
 const expected=['','events','shop','faq'];
 if(base.areas.length!==4||!expected.every((x,i)=>base.areas[i].action.uri==='https://liff.line.me/2012021712-Dqh6Z8aq/'+x))throw Error('OA layout mismatch');
 const areas=base.areas.map((a,i)=>({action:a.action,bounds:{x:i%2*640,y:i<2?0:432,width:640,height:432}}));
 const list=await line('/richmenu/list'),found=list.richmenus.find(r=>r.name===name);
 const id=found?.richMenuId||(await line('/richmenu','POST',{headers:{'Content-Type':'application/json'},body:JSON.stringify({name,size:{width:1280,height:864},areas,selected:true,chatBarText:'生日快樂'})})).richMenuId;
 const content='/richmenu/'+id+'/content',host='https://api-data.line.me/v2/bot';
 if(!await line(content,'GET',{host,bytes:true,missing:true})){await line(content,'POST',{host,headers:{'Content-Type':'image/jpeg'},body:fs.readFileSync(__dirname+'/menu.jpg')});}
 if(!(await line(content,'GET',{host,bytes:true})).length)throw Error('Missing menu art');
 await db.$executeRawUnsafe("insert into identity.member_season_menus(theme,menu_id) values ('birthday',$1) on conflict(theme) do nothing",id);
}
async function due(db){
 return db.$queryRawUnsafe(`SELECT p.person_id::text AS id,p.preferred_name,p.legal_name,p.email,p.email_verified_at,d.today::text AS day FROM identity.person p CROSS JOIN ${dateFrom} WHERE ${eligible} AND (${birthdaySQL}) ORDER BY p.person_id`);
}
async function deliver(db,p,channel,destination,send){
 const evidenceHash=createHash('sha256').update('birthday/'+p.day.slice(0,4)+'/'+p.id).digest('hex');
 const key={personId:p.id,channel,notificationType:'BIRTHDAY',evidenceHash};
 const claim=await db.notificationDelivery.createMany({data:[{...key,status:'PENDING',destinationBindingId:destination,expiresAt:new Date(p.day+'T16:00:00Z')}],skipDuplicates:true});
 const row=await db.notificationDelivery.findUniqueOrThrow({where:{personId_channel_notificationType_evidenceHash:key}});
 if(['SENT','EXPIRED'].includes(row.status)||row.failureCode==='REVIEW_DELIVERY'||row.attemptCount>=6)return;
 // Unknown email outcomes need reconciliation. LINE accepts the same retry key for retries.
 if(!claim.count && row.lastAttemptAt && Date.now()-row.lastAttemptAt.getTime()<300000)return;
 if(channel==='EMAIL'&&row.attemptCount)return;
 const where={notificationDeliveryId:row.notificationDeliveryId,attemptCount:row.attemptCount,status:row.status};
 const locked=await db.notificationDelivery.updateMany({where,data:{attemptCount:{increment:1},lastAttemptAt:new Date(),status:'PENDING'}});
 if(!locked.count)return;
 try{await send(row.notificationDeliveryId);await db.notificationDelivery.update({where:{notificationDeliveryId:row.notificationDeliveryId},data:{status:'SENT',sentAt:new Date(),failureCode:null}})}
 catch{await db.notificationDelivery.update({where:{notificationDeliveryId:row.notificationDeliveryId},data:{status:'FAILED',failureCode:channel==='EMAIL'?'REVIEW_DELIVERY':'LINE_DELIVERY_FAILED'}})}
}
async function celebrate(db,p){
 const salutation=(p.preferred_name||p.legal_name||'親愛的會員')+'，您好：';
 const key='birthday:'+p.day.slice(0,4)+':'+p.id;
 await db.memberNotification.upsert({where:{messageKey:key},update:{},create:{messageKey:key,personId:p.id,category:'SYSTEM',title:copy.inboxTitle,body:salutation+'\n\n'+copy.inbox,deepLink:'/',sourceType:'BIRTHDAY',sourceReference:key}});
 if(p.email_verified_at&&p.email&&mail.isSelected())await deliver(db,p,'EMAIL',null,()=>mail.send({to:p.email,subject:copy.subject,text:salutation+'\n\n'+copy.email}));
 const binding=await db.identityLink.findFirst({where:{personId:p.id,provider:'LINE',status:'ACTIVE',revokedAt:null},orderBy:{identityLinkId:'asc'},select:{identityLinkId:true,providerSubject:true}});
 if(!binding||!/^U[0-9a-f]{32}$/.test(binding.providerSubject))return;
 await deliver(db,p,'LINE',binding.identityLinkId,async retry=>{
  const r=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{Authorization:'Bearer '+process.env.LINE_CHANNEL_ACCESS_TOKEN,'Content-Type':'application/json','X-Line-Retry-Key':retry},body:JSON.stringify({to:binding.providerSubject,messages:[{type:'text',text:copy.line}]}),signal:AbortSignal.timeout(10000)});
  if(!r.ok&&!(r.status===409&&r.headers.has('x-line-accepted-request-id')))throw Error('LINE delivery');
 });
}
async function run(db){
 const rows=await due(db),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
 // Menu is visible all day. Deliver messages from 09:00 Taipei time.
 let faults=0;
 try{await db.$transaction(async tx=>{await tx.$queryRawUnsafe("select 1 from pg_advisory_xact_lock(16413271)");await menu(tx)},{timeout:45000})}catch{faults++}
 const stale=await db.$queryRawUnsafe("select distinct person_id::text as id from identity.member_season_binding where applied='birthday'");
 for(const id of new Set([...rows.map(p=>p.id),...stale.map(p=>p.id)])){
  try{await change(db,id)}catch{faults++}
 }
 for(const p of rows)if(hour>=9){try{await celebrate(db,p)}catch{faults++}}
 console.log(JSON.stringify({event:'BIRTHDAY_SCAN',eligible:rows.length,sendWindow:hour>=9,faults}));
}
function start(){
 const {PrismaClient}=require('@prisma/client'),db=new PrismaClient();let busy=false;
 const tick=async()=>{if(busy)return;busy=true;try{await run(db)}catch{console.error('BIRTHDAY_SCAN_FAILED')}finally{busy=false}};
 setTimeout(tick,10000).unref();setInterval(tick,300000).unref();
}
module.exports={start,run,due,birthdaySQL,eligible,dateFrom};
