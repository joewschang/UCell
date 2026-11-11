'use strict';
const {BadRequestException,ConflictException,NotFoundException}=require('@nestjs/common');
const {inventory,visible}=require('./catalog');
const {createHash}=require('node:crypto');
const valid=t=>typeof t==='string'&&/^[-\p{L}\p{N}]{1,18}$/u.test(t);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
async function tag(tx,name){
 const [reserved]=await tx.$queryRaw`SELECT name FROM integration.topic_tag WHERE name=${name} AND archived UNION ALL SELECT alias FROM integration.topic_tag_alias WHERE alias=${name}`;
 if(reserved)throw new ConflictException('此名稱已更名或封存，請使用有效的名稱');
 const [r]=await tx.$queryRaw`INSERT INTO integration.topic_tag(name) VALUES(${name}) ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id`;
 return r.id;
}
async function snapshot(db){
 const [assignments,relations,names]=await Promise.all([
 db.$queryRawUnsafe('SELECT resource_key AS id,name FROM integration.topic_tag_assignment JOIN integration.topic_tag ON id=tag_id WHERE NOT archived ORDER BY resource_key,name'),
 db.$queryRawUnsafe('SELECT a.name AS a,b.name AS b,r.kind FROM integration.topic_tag_relation r JOIN integration.topic_tag a ON a.id=r.from_id JOIN integration.topic_tag b ON b.id=r.to_id WHERE NOT a.archived AND NOT b.archived ORDER BY 1,2,3'),
 db.$queryRawUnsafe('SELECT name,archived FROM integration.topic_tag ORDER BY name')]);
 const links=new Map();
 for(const row of assignments){if(!links.has(row.id))links.set(row.id,[]);links.get(row.id).push(row.name);}
 return {links,relations,names:names.filter(t=>!t.archived).map(t=>t.name),archived:names.filter(t=>t.archived).map(t=>t.name)};
}
async function view(s,person,admin){
 const [items,data]=await Promise.all([admin?inventory(s):visible(s,person),snapshot(s.db)]);
 const rows=items.map(({id,title,kind,status,href,hash:sourceHash})=>({id,title,kind,status,href,sourceHash,tags:data.links.get(id)??[]}));
 const shown=new Set(rows.flatMap(r=>r.tags));
 const edges=data.relations.filter(e=>admin||shown.has(e.a)&&shown.has(e.b));
 const result={rows:admin?rows:rows.filter(r=>r.tags.length),tags:admin?data.names:[...shown].sort(),edges};
 const aliases=await s.db.$queryRawUnsafe('SELECT alias,name FROM integration.topic_tag_alias JOIN integration.topic_tag ON id=tag_id WHERE NOT archived');
 result.aliases=Object.fromEntries(aliases.filter(x=>admin||shown.has(x.name)).map(x=>[x.alias,x.name]));
 if(admin){
 result.archived=data.archived;
 result.version=hash([rows.map(r=>[r.id,r.tags,r.sourceHash]).sort((a,b)=>a[0].localeCompare(b[0])),edges,data.names,data.archived,result.aliases]);
 const jobs=await s.db.$queryRawUnsafe('SELECT resource_key AS id,state,proposal,source_hash AS fingerprint FROM integration.topic_tag_job');
 result.jobs=jobs.filter(j=>rows.some(r=>r.id===j.id&&r.sourceHash===j.fingerprint));
 }
 return result;
}
async function write(s,body,actor){
 if(!body||typeof body.version!=='string')throw new BadRequestException('請重新整理');
 return s.db.$transaction(async tx=>{
 await tx.$queryRawUnsafe('SELECT true FROM (SELECT pg_advisory_xact_lock(261111053)) l');
 const current=await view({db:tx},null,true);
 if(current.version!==body.version)throw new ConflictException('資料已更新，請重新載入');
 if(['createTag','renameTag','mergeTag','archiveTag','restoreTag'].includes(body.action)){
 await require('./dictionary').manage(tx,body,actor);
 }else if(body.action==='assign'){
 const r=current.rows.find(x=>x.id===body.id);
 if(!r||!Array.isArray(body.tags)||body.tags.length>30||!body.tags.every(valid))throw new BadRequestException('標籤格式錯誤');
 const tags=[...new Set(body.tags)];
 for(const old of r.tags.filter(t=>!tags.includes(t)))await tx.$executeRaw`DELETE FROM integration.topic_tag_assignment WHERE resource_key=${r.id} AND tag_id=(SELECT id FROM integration.topic_tag WHERE name=${old})`;
 for(const name of tags.filter(t=>!r.tags.includes(t))){
 const id=await tag(tx,name);await tx.$executeRaw`INSERT INTO integration.topic_tag_assignment VALUES(${r.id},${id},'editor',${actor}) ON CONFLICT DO NOTHING`;
 }
 }else if(body.action==='edge'||body.action==='removeEdge'){
 const {a,b,kind}=body;
 if(![a,b].every(t=>current.tags.includes(t))||a===b||!valid(kind))throw new BadRequestException('請選兩個不同標籤及關係');
 if(body.action==='edge')await tx.$executeRaw`INSERT INTO integration.topic_tag_relation VALUES(${await tag(tx,a)},${await tag(tx,b)},${kind},'editor',${actor}) ON CONFLICT DO NOTHING`;
 else await tx.$executeRaw`DELETE FROM integration.topic_tag_relation WHERE from_id=${await tag(tx,a)} AND to_id=${await tag(tx,b)} AND kind=${kind}`;
 }else if(body.action==='apply'||body.action==='dismiss'){
 const [job]=await tx.$queryRaw`SELECT * FROM integration.topic_tag_job WHERE resource_key=${body.id} FOR UPDATE`;
 const r=current.rows.find(x=>x.id===body.id);
 if(!r||job?.state!=='review'||job.source_hash!==r.sourceHash||body.proposalKey!==hash(job.proposal))throw new ConflictException('建議已更新');
 if(body.action==='apply'){
 for(const x of job.proposal.tags){const id=await tag(tx,x.name);await tx.$executeRaw`INSERT INTO integration.topic_tag_assignment VALUES(${r.id},${id},'azure-ai',${x.evidence}) ON CONFLICT DO NOTHING`;}
 for(const x of job.proposal.edges){const a=await tag(tx,x.a),b=await tag(tx,x.b);await tx.$executeRaw`INSERT INTO integration.topic_tag_relation VALUES(${a},${b},${x.kind},'azure-ai',${x.evidence}) ON CONFLICT DO NOTHING`;}
 }
 await tx.$executeRaw`UPDATE integration.topic_tag_job SET state=${body.action==='apply'?'applied':'dismissed'} WHERE resource_key=${body.id}`;
 }else throw new BadRequestException('無效的異動');
 if(body.action==='assign'||body.action==='apply')await require('./health-tags').mirror(tx,body.id,actor);
 await tx.$executeRaw`INSERT INTO integration.topic_tag_change(actor,action,detail) VALUES(${actor},${body.action},${JSON.stringify(body)}::jsonb)`;
 return {saved:true};
 },{timeout:20000});
}
module.exports={view,write,hash,valid};
