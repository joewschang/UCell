'use strict';
const {Get,Post,Req,Body,Header,SetMetadata,BadRequestException,ConflictException}=require('@nestjs/common');
const keys=['christmas','newyear','lunar'];
let initialized;
function init(db){
 if(!initialized)initialized=db.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS identity.theme_calendar (theme text primary key, enabled boolean not null, starts timestamptz, ends timestamptz, revision integer not null, actor text not null, updated_at timestamptz not null default now())").catch(e=>{initialized=undefined;throw e});
 return initialized;
}
async function list(db){
 await init(db);
 const rows=await db.$queryRawUnsafe('SELECT theme, enabled, starts, ends, revision FROM identity.theme_calendar');
 return keys.map(theme=>rows.find(x=>x.theme===theme)||{theme,enabled:false,starts:null,ends:null,revision:0});
}
function current(rows,now=Date.now()){
 const active=rows.find(r=>r.enabled&&(!r.starts||+new Date(r.starts)<=now)&&(!r.ends||now<+new Date(r.ends)));
 const edges=rows.filter(r=>r.enabled).flatMap(r=>[r.starts,r.ends]).filter(Boolean).map(d=>+new Date(d)).filter(t=>t>now);
 return {theme:active?.theme||'classic',nextChange:edges.length?new Date(Math.min(...edges)):null};
}
async function save(db,b,actor){
 if(!b||!keys.includes(b.theme)||typeof b.enabled!=='boolean'||!Number.isInteger(b.revision)||b.revision<0)throw new BadRequestException('主題設定無效');
 for(const date of [b.starts,b.ends])if(date!==null&&(typeof date!=='string'||!/^\d{4}-\d\d-\d\dT.*Z$/.test(date)||!Number.isFinite(Date.parse(date))))throw new BadRequestException('請確認開始與結束時間');
 if(b.starts&&b.ends&&Date.parse(b.starts)>=Date.parse(b.ends))throw new BadRequestException('下架時間須晚於上架時間');
 await init(db);
 return db.$transaction(async tx=>{
 await tx.$queryRawUnsafe('SELECT 1 FROM pg_advisory_xact_lock(82781023)');
 const rows=await list(tx),prior=rows.find(r=>r.theme===b.theme);
 if(prior.revision!==b.revision)throw new ConflictException('資料已更新，請重新載入');
 if(b.enabled&&rows.some(r=>r.enabled&&r.theme!==b.theme&&(!b.ends||!r.starts||Date.parse(b.ends)>+new Date(r.starts))&&(!r.ends||!b.starts||+new Date(r.ends)>Date.parse(b.starts))))throw new ConflictException('上架時段與其他主題重疊');
 await tx.$executeRawUnsafe('INSERT INTO identity.theme_calendar(theme,enabled,starts,ends,revision,actor) VALUES ($1,$2,$3::timestamptz,$4::timestamptz,1,$5) ON CONFLICT(theme) DO UPDATE SET enabled=excluded.enabled,starts=excluded.starts,ends=excluded.ends,revision=theme_calendar.revision+1,actor=excluded.actor,updated_at=now()',b.theme,b.enabled,b.starts,b.ends,actor);
 return list(tx);
 });
}
function register(pub,admin){
 function route(cls,key,verb,url,fn,write){
 Object.defineProperty(cls.prototype,key,{value:fn,configurable:true});const d=Object.getOwnPropertyDescriptor(cls.prototype,key);
 Header('Cache-Control','no-store')(cls.prototype,key,d);
 if(cls===admin)SetMetadata('roles',['SUPER_ADMIN','ORDER_OPS'])(cls.prototype,key,d);
 if(write){Req()(cls.prototype,key,0);Body()(cls.prototype,key,1)}
 verb(url)(cls.prototype,key,d);
 }
 route(pub,'currentThemeCalendar',Get,'themes/current',async function(){return current(await list(this.service.db))});
 route(admin,'readThemeCalendar',Get,'themes/calendar',function(){return list(this.service.db)});
 route(admin,'writeThemeCalendar',Post,'themes/calendar',function(req,body){return save(this.service.db,body,String(req.user?.personId||req.user?.subject||req.user?.role))},true);
}
module.exports={register,current,list,save};
