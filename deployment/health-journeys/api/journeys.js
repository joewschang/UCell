'use strict';
const {Get,Post,Req,Body,Query,BadRequestException,ConflictException,ForbiddenException}=require('@nestjs/common');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');
const registry=require('./games.json');
const topics=require('../topics');
const {inventory,visible}=require('../catalog');
const reportSql=fs.readFileSync(path.join(__dirname,'metrics.sql'),'utf8');
const ids=registry.map(g=>g.id), covers=registry.map(g=>g.cover);
const uuid=v=>typeof v==='string'&&/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(v);
const invalid=()=>{throw new BadRequestException('請確認送出的資料')};
const current=async db=>(await db.$queryRaw`SELECT * FROM integration.health_journey_version ORDER BY version DESC LIMIT 1`)[0];
const cleanText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const inWindow=g=>g.enabled&&(!g.starts||Date.parse(g.starts)<=Date.now())&&(!g.ends||Date.parse(g.ends)>Date.now());
function validate(games,resources){
 if(!Array.isArray(games)||games.length!==ids.length||new Set(games.map(g=>g?.id)).size!==ids.length)invalid();
 return games.map(g=>{
   if(!ids.includes(g.id)||!covers.includes(g.cover)||!cleanText(g.description,180)||!cleanText(g.interest,32)||!cleanText(g.invite,160)||!cleanText(g.campaign,40)||
      typeof g.enabled!=='boolean'||typeof g.membersOnly!=='boolean'||![g.starts,g.ends].every(v=>v===''||(typeof v==='string'&&v.length<=32&&Number.isFinite(Date.parse(v))))||
      (g.starts&&g.ends&&Date.parse(g.ends)<=Date.parse(g.starts))||!Array.isArray(g.pinned)||g.pinned.length>12||
      new Set(g.pinned).size!==g.pinned.length||g.pinned.some(id=>!resources.has(id)||ids.includes(id)))invalid();
   return Object.fromEntries(['id','description','interest','invite','campaign','cover','enabled','membersOnly','starts','ends','pinned'].map(k=>[k,g[k]]));
 });
}
function publicGame(g){const {name,href}=registry.find(x=>x.id===g.id);return {id:g.id,name,href,cover:g.cover,description:g.description,interest:g.interest,invite:g.invite,membersOnly:g.membersOnly};}
async function eligible(s,person){
 const [items,tagModel]=await Promise.all([visible(s,person),topics.view(s,person,false)]);
 const tags=new Map(tagModel.rows.map(r=>[r.id,r.tags]));
 const rows=items.filter(r=>!ids.includes(r.id)).map(r=>({...r,tags:tags.get(r.id)||[]}));
 if(!person)return {rows,tagModel};
 const [stock,events]=await Promise.all([
 s.db.$queryRaw`SELECT p.sku,p.current_price::float8 price,p.currency FROM commerce.product_reference p WHERE p.is_active AND EXISTS(SELECT 1 FROM commerce.product_content pc WHERE pc.product_id=p.product_id AND pc.published IS NOT NULL)
 AND (SELECT count(*)=1 AND bool_and(rule_version_code='R1.0B' AND parameter_snapshot_hash ~ '^[a-f0-9]{64}$') FROM commerce.product_rule_profile WHERE product_id=p.product_id AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()))
 AND EXISTS(SELECT 1 FROM commerce.commercial_offering o JOIN commerce.commercial_offering_version v USING(commercial_offering_id)
 WHERE o.status='ACTIVE' AND o.offering_type='CORE_PRODUCT' AND v.status='ACTIVE' AND v.effective_from<=now() AND (v.effective_to IS NULL OR v.effective_to>now()) AND v.channels @> '["WEB_MEMBER"]'::jsonb AND
 ((jsonb_array_length(v.composition)=1 AND v.composition->0->>'sku'=p.sku) OR v.selection_rule->'eligibleSkus'=jsonb_build_array(p.sku))) AND
 (NOT EXISTS(SELECT 1 FROM commerce.inventory_item i WHERE i.product_id=p.product_id AND i.tracking_mode<>'NONE')
 OR EXISTS(SELECT 1 FROM commerce.inventory_item i JOIN commerce.inventory_balance b USING(inventory_item_id) WHERE i.product_id=p.product_id AND b.on_hand>b.reserved))`,
 s.db.$queryRaw`SELECT e.event_code,v.starts_at,v.capacity,count(r.member_event_registration_id)::int booked FROM learning.member_event e
 JOIN LATERAL (SELECT * FROM learning.member_event_version WHERE member_event_id=e.member_event_id AND status='PUBLISHED' ORDER BY version DESC LIMIT 1)v ON true
 LEFT JOIN learning.member_event_registration r ON r.member_event_id=e.member_event_id AND r.status<>'CANCELLED'
 WHERE e.status='PUBLISHED' AND v.starts_at>now() GROUP BY e.event_code,v.starts_at,v.capacity`]);
 const products=new Map(stock.map(x=>['sku:'+x.sku,x])),sessions=new Map(events.map(x=>['event:'+x.event_code,x]));
 return {tagModel,rows:rows.filter(r=>{
   if(r.id.startsWith('sku:')){const p=products.get(r.id);if(!p)return false;r.detail=p.currency+' '+p.price;r.href='/shop/products/'+encodeURIComponent(p.sku); }
   if(r.id.startsWith('event:')){const e=sessions.get(r.id);if(!e||e.capacity!==null&&e.booked>=e.capacity)return false;r.detail=new Date(e.starts_at).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'})+(e.capacity===null?'':' · 剩 '+(e.capacity-e.booked)+' 名');}
   return true;
 })};
}
function recommend(g,rows,m){
 const own=m.rows.find(r=>r.id===g.id)?.tags||[];
 const precise=own.filter(t=>!['健康','日常觀察','延伸探索','居家自我觀察'].includes(t));
 const adjacent=new Set(m.edges.flatMap(e=>precise.includes(e.a)?[e.b]:precise.includes(e.b)?[e.a]:[]));
 const picks=rows.map(r=>{const pin=g.pinned.indexOf(r.id);let score=0;if(pin>=0)score=1000-pin;
 else if(r.kind!=='商品')score=r.tags.reduce((n,t)=>n+(precise.includes(t)?10:adjacent.has(t)?1:0),0);
 return {r,score};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.r.title.localeCompare(b.r.title,'zh-TW'));
 return picks.slice(0,6).map(x=>x.r);
}
async function listing(s,person){
 const [v,base]=await Promise.all([current(s.db),s.config()]);
 const games=base.config.open?v.games.filter(inWindow).map(publicGame):[];
 const stamps=person?(await s.db.$queryRaw`SELECT count(*)::int n,max(completed_at AT TIME ZONE 'Asia/Taipei')::date::text latest FROM integration.health_egfr_stamp WHERE person_id=${person}::uuid`)[0]:null;
 const passport=person?await s.db.$queryRaw`SELECT 'game' id,count(*)::int n,max(completed_at AT TIME ZONE 'Asia/Taipei')::date::text latest FROM integration.health_game_week WHERE person_id=${person}::uuid AND completed_at IS NOT NULL
 UNION ALL SELECT 'diabetes',count(*)::int,max(completed_at AT TIME ZONE 'Asia/Taipei')::date::text FROM integration.health_diabetes_week WHERE person_id=${person}::uuid AND completed_at IS NOT NULL`:[];
 if(person){const [bp]=await s.db.$queryRaw`SELECT count(*)::int n,max(completed_at AT TIME ZONE 'Asia/Taipei')::date::text latest FROM integration.health_bp_stamp WHERE person_id=${person}::uuid`;passport.push({id:'blood-pressure',...bp});}
 if(person){const [bp]=await s.db.$queryRaw`SELECT count(*)::int n,max(completed_at AT TIME ZONE 'Asia/Taipei')::date::text latest FROM integration.health_cognition_stamp WHERE person_id=${person}::uuid`;passport.push({id:'cognition',...bp});}
 if(stamps)passport.push({id:'egfr',...stamps});
 return {games,version:v.version,passport};
}
async function resources(s,person,id){
 const [v,base]=await Promise.all([current(s.db),s.config()]);const g=v.games.find(r=>r.id===id);
 if(!base.config.open||!g||!inWindow(g)||g.membersOnly&&!person)return [];
 const {rows,tagModel}=await eligible(s,person);return recommend(g,rows,tagModel);
}
async function adminView(s){
 const [v,[draft],catalog,history,metrics,channels,changes]=await Promise.all([current(s.db),s.db.$queryRaw`SELECT * FROM integration.health_journey_draft WHERE id=1`, topics.view(s,null,true),
 s.db.$queryRaw`SELECT version,actor,created_at FROM integration.health_journey_version ORDER BY version DESC LIMIT 30`,s.db.$queryRawUnsafe(reportSql),
 s.db.$queryRaw`SELECT i.source_game game,i.campaign,i.channel,i.version,count(DISTINCT i.id)::int shares,count(DISTINCT i.owner)::int sharers,
 count(DISTINCT e.visitor) FILTER (WHERE e.action='arrive')::int arrivals,count(DISTINCT e.visitor) FILTER (WHERE e.action='start')::int starts FROM integration.health_journey_invite i
 LEFT JOIN integration.health_journey_event e ON e.invite=i.id AND e.visitor<>i.owner WHERE i.created_at>=now()-interval '30 days' GROUP BY 1,2,3,4 ORDER BY 1,2,3`,s.db.$queryRaw`SELECT revision,action,actor,reason,created_at FROM integration.health_journey_change ORDER BY revision DESC LIMIT 30`]);
 return {live:v.games,version:v.version,draft:draft.games,revision:draft.revision,history,metrics,channels,changes,registry,
 suggestions:catalog.jobs.filter(j=>ids.includes(j.id)).map(j=>({id:j.id,state:j.state,proposal:j.proposal})),resources:catalog.rows.filter(r=>r.status==='PUBLISHED'&&!ids.includes(r.id)),tags:catalog.rows.filter(r=>ids.includes(r.id)),edges:catalog.edges};
}
async function save(s,b,user){
 if(!b||!['draft','publish','restore','revoke'].includes(b.action)||!Number.isInteger(b.revision))invalid();
 if(['publish','revoke'].includes(b.action)&&!['SUPER_ADMIN','MEMBERSHIP_OPS'].includes(user.role))throw new ForbiddenException('此操作需要上架權限');
 const actor=String(user.personId??user.subject);
 const items=new Set((await inventory(s)).filter(r=>r.status==='PUBLISHED').map(r=>r.id));
 return s.db.$transaction(async tx=>{
   const [d]=await tx.$queryRaw`SELECT * FROM integration.health_journey_draft WHERE id=1 FOR UPDATE`;
   if(d.revision!==b.revision)throw new ConflictException('設定已有更新，請重新載入');
   if(b.action==='revoke'){
     if(!ids.includes(b.game)||!cleanText(b.campaign,40))invalid();
     await tx.$executeRaw`UPDATE integration.health_journey_invite SET revoked=true WHERE source_game=${b.game} AND campaign=${b.campaign} AND NOT revoked`;
   }
   let games=d.games;
   if(b.action==='restore'){
     if(!Number.isInteger(b.version))invalid();
     const [old]=await tx.$queryRaw`SELECT games FROM integration.health_journey_version WHERE version=${b.version}`;if(!old)invalid();games=[...old.games,...d.games.filter(g=>!old.games.some(previous=>previous.id===g.id)).map(g=>({...g,enabled:false}))];
   }else if(b.action!=='revoke') games=validate(b.games,items);
   if(b.action==='publish'){
     const v=await current(tx);await tx.$executeRaw`INSERT INTO integration.health_journey_version(version,games,actor) VALUES(${v.version+1},${JSON.stringify(games)}::jsonb,${actor})`;
   }
   await tx.$executeRaw`UPDATE integration.health_journey_draft SET revision=revision+1,games=${JSON.stringify(games)}::jsonb,actor=${actor},updated_at=now() WHERE id=1`;
   await tx.$executeRaw`INSERT INTO integration.health_journey_change(revision,action,actor,reason,before_data,after_data) VALUES(${d.revision+1},${b.action},${actor},${String(b.reason||'').slice(0,200)},${JSON.stringify(d.games)}::jsonb,${JSON.stringify(games)}::jsonb)`;
   return {saved:true};
 });
}
async function invite(s,b,person){
 if(!b||Object.keys(b).some(k=>!['visitor','game','generic','channel'].includes(k))||!uuid(b.visitor)||!ids.includes(b.game)||typeof b.generic!=='boolean'||!['line','copy','qr','native'].includes(b.channel))invalid();
 const v=await current(s.db),g=v.games.find(x=>x.id===b.game);
 if(!inWindow(g)||g.membersOnly&&!person||!(await s.config()).config.open)throw new ConflictException();
 const id=randomUUID();await s.db.$executeRaw`INSERT INTO integration.health_journey_invite(id,owner,source_game,generic,channel,campaign,version,expires_at)
 VALUES(${id}::uuid,${b.visitor}::uuid,${g.id},${b.generic},${b.channel},${g.campaign},${v.version},least(now()+interval '30 days',coalesce(${g.ends||null}::timestamptz,'infinity'::timestamptz)))`;
 return {id};
}
async function event(s,b,person){
 if(!b||!uuid(b.visitor)||!uuid(b.attempt)||!ids.includes(b.game)||!['arrive','start','calculate','finish','impression','click','detail','cart','registration_start'].includes(b.action)||
   Object.keys(b).some(k=>!['visitor','attempt','game','action','resource','invite'].includes(k)))invalid();
 const id=b.resource||'';const downstream=['detail','cart','registration_start'].includes(b.action);
 const targeted=downstream||['impression','click'].includes(b.action);
 if(targeted&&!downstream&&!(await resources(s,person,b.game)).some(r=>r.id===id)||!targeted&&id)invalid();
 if(b.invite&&!uuid(b.invite))invalid();
 const v=await current(s.db),g=v.games.find(x=>x.id===b.game);
 if(!inWindow(g)||g.membersOnly&&!person||!(await s.config()).config.open)throw new ConflictException();
 return s.db.$transaction(async tx=>{
   let source=null;
   if(b.invite){[source]=await tx.$queryRaw`SELECT id FROM integration.health_journey_invite WHERE id=${b.invite}::uuid AND owner<>${b.visitor}::uuid AND (generic OR source_game=${g.id}) AND NOT revoked AND expires_at>now()`;}
   if(['finish','calculate'].includes(b.action)){
     const [start]=await tx.$queryRaw`SELECT 1 FROM integration.health_journey_event WHERE attempt=${b.attempt}::uuid AND game=${g.id} AND visitor=${b.visitor}::uuid AND action='start'`;
     if(!start)throw new ConflictException('請重新開始遊戲');
   }
   if(downstream){
     const [clicked]=await tx.$queryRaw`SELECT 1 FROM integration.health_journey_event WHERE attempt=${b.attempt}::uuid AND game=${g.id} AND visitor=${b.visitor}::uuid AND action='click' AND resource=${id} AND person_id=${person}::uuid`;
     if(!clicked)throw new ConflictException();
   }
   const buyer=b.action==='click'&&/^(sku|event|course):/.test(id)?person:null;
   await tx.$executeRaw`INSERT INTO integration.health_journey_event(attempt,game,action,resource,visitor,invite,person_id,campaign,version)
   VALUES(${b.attempt}::uuid,${g.id},${b.action},${id},${b.visitor}::uuid,${source?.id||null}::uuid,${buyer||null}::uuid,${g.campaign},${v.version}) ON CONFLICT DO NOTHING`;
   if(person&&g.id==='blood-pressure'&&b.action==='finish')await tx.$executeRaw`INSERT INTO integration.health_bp_stamp(person_id,week) VALUES(${person}::uuid,date_trunc('week',now() AT TIME ZONE 'Asia/Taipei')::date) ON CONFLICT DO NOTHING`;
   if(person&&g.id==='cognition'&&b.action==='finish')await tx.$executeRaw`INSERT INTO integration.health_cognition_stamp(person_id,week) VALUES(${person}::uuid,date_trunc('week',now() AT TIME ZONE 'Asia/Taipei')::date) ON CONFLICT DO NOTHING`;
   if(person&&g.id==='egfr'&&b.action==='finish')await tx.$executeRaw`INSERT INTO integration.health_egfr_stamp(person_id,week) VALUES(${person}::uuid,date_trunc('week',now() AT TIME ZONE 'Asia/Taipei')::date) ON CONFLICT DO NOTHING`;
   return {ok:true};
 });
}
function route(cls,key,verb,url,args,fn){Object.defineProperty(cls.prototype,key,{value:fn});args.forEach((dec,i)=>dec()(cls.prototype,key,i));verb(url)(cls.prototype,key,Object.getOwnPropertyDescriptor(cls.prototype,key));}
module.exports=function install({HealthGameService,PublicHealthGame,MemberHealthGame,AdminHealthGame}){
 const init=HealthGameService.prototype.onModuleInit;
 HealthGameService.prototype.onModuleInit=async function(){await init.call(this);await require('./setup')(this.db);};
 for(const [cls,member] of [[PublicHealthGame,false],[MemberHealthGame,true]]){
  const person=req=>member?req.user.personId:null;
  route(cls,'journeyList',Get,'journey',[Req],function(req){return listing(this.service,person(req));});
  route(cls,'journeyRelated',Get,'journey/related',[Query,Req],function(q,r){return resources(this.service,person(r),q.game);});
  route(cls,'journeyInvite',Post,'journey/invite',[Body,Req],function(b,r){return invite(this.service,b,person(r));});
  route(cls,'journeyEvent',Post,'journey/event',[Body,Req],function(b,r){return event(this.service,b,person(r));});
 }
 route(PublicHealthGame,'journeyResolve',Get,'journey/invite',[Query],async function(q){
  if(!uuid(q.id))return {game:null};const [i]=await this.service.db.$queryRaw`SELECT source_game,generic,expires_at<=now() expired FROM integration.health_journey_invite WHERE id=${q.id}::uuid AND NOT revoked`;
  if(!i)return {game:null,expired:true};return {game:i.generic?null:i.source_game,expired:i.expired};
 });
 route(MemberHealthGame,'journeyClaim',Post,'journey/claim',[Body,Req],async function(b,r){
  if(!ids.includes(b?.game)||!uuid(b.attempt)||!uuid(b.visitor))invalid();
  const person=r.user.personId;
  return this.service.db.$transaction(async tx=>{
   const [valid]=await tx.$queryRaw`SELECT 1 FROM integration.health_journey_event WHERE game=${b.game} AND visitor=${b.visitor}::uuid AND attempt=${b.attempt}::uuid AND action='finish' AND occurred_at>now()-interval '1 hour'`;
   if(!valid)throw new ConflictException('體驗已過期');
   const added=await tx.$executeRaw`INSERT INTO integration.health_journey_claim(attempt) VALUES(${b.attempt}::uuid) ON CONFLICT DO NOTHING`;
   if(!added)throw new ConflictException('這次體驗已領取');
   const table={game:'health_game_week',diabetes:'health_diabetes_week',egfr:'health_egfr_stamp','blood-pressure':'health_bp_stamp',cognition:'health_cognition_stamp'}[b.game];
   await tx.$executeRawUnsafe("INSERT INTO integration."+table+"(person_id,week,completed_at) VALUES($1::uuid,date_trunc('week',now() AT TIME ZONE 'Asia/Taipei')::date,now()) ON CONFLICT(person_id,week) DO UPDATE SET completed_at=coalesce("+table+".completed_at,excluded.completed_at)",person);
   return {ok:true};
  });
 });
 route(MemberHealthGame,'journeyOrder',Post,'journey/order',[Body,Req],async function(b,r){
   if(!uuid(b?.order)||!uuid(b.attempt)||!uuid(b.visitor))invalid();
   const person=r.user.personId;
   await this.service.db.$executeRaw`INSERT INTO integration.health_journey_order(order_id,attempt,game,resource)
    SELECT o.order_id,e.attempt,e.game,e.resource FROM commerce."order" o JOIN commerce.order_line l USING(order_id)
    JOIN integration.health_journey_event e ON e.resource='sku:'||l.sku_snapshot AND e.action='click' AND e.person_id=${person}::uuid
    WHERE e.attempt=${b.attempt}::uuid AND e.visitor=${b.visitor}::uuid AND o.order_id=${b.order}::uuid AND o.purpose='RETAIL'
    AND (o.purchaser_person_id=e.person_id OR (o.purchaser_person_id IS NULL AND EXISTS(SELECT 1 FROM audit.audit_event a WHERE a.entity_type='ORDER' AND a.entity_id=o.order_id AND a.action='ORDER_CREATED_CONFIRMED' AND a.actor_id=e.person_id)))
    AND o.created_at BETWEEN e.occurred_at AND e.occurred_at+interval '7 days' ORDER BY e.occurred_at DESC LIMIT 1 ON CONFLICT DO NOTHING`;
   return {ok:true};
 });
 route(AdminHealthGame,'journeyCampaign',Post,'journey/invite',[Body,Req],function(b,r){return invite(this.service,b,r.user.personId);});
 route(AdminHealthGame,'journeyAdmin',Get,'journey',[Req],async function(r){return {...await adminView(this.service),canPublish:['SUPER_ADMIN','MEMBERSHIP_OPS'].includes(r.user.role)};});
 route(AdminHealthGame,'journeyPreview',Post,'journey/preview',[Body,Req],async function(b,r){
  const items=new Set((await inventory(this.service)).filter(x=>x.status==='PUBLISHED').map(x=>x.id));
  const g=validate(b.games,items).find(x=>x.id===b.game);if(!g)invalid();
  const {rows,tagModel}=await eligible(this.service,b.member?r.user.personId:null);
  return recommend(g,rows,tagModel);
 });
 route(AdminHealthGame,'journeySave',Post,'journey',[Body,Req],function(b,r){return save(this.service,b,r.user);});
};
module.exports.recommend=recommend;

module.exports.active=async(db,id)=>(await current(db)).games.some(g=>g.id===id&&inWindow(g));
