'use strict';
const {ConflictException}=require('@nestjs/common');
async function mirror(tx,id,actor){
 if(id.startsWith('course:')||id.startsWith('event:'))return;
 if(id.startsWith('content:')&&!await tx.publishedContent.count({where:{contentId:id.slice(8),status:'PUBLISHED'}}))return;
 const [row]=await tx.$queryRawUnsafe('SELECT version,config FROM integration.health_game_config WHERE id=1 FOR UPDATE');
 const tags=(await tx.$queryRaw`SELECT name FROM integration.topic_tag JOIN integration.topic_tag_assignment a ON a.tag_id=id WHERE NOT archived AND a.resource_key=${id} ORDER BY name`).map(x=>x.name);
 const config=row.config;
 if(JSON.stringify([...(config.links[id]??[])].sort())===JSON.stringify([...tags].sort()))return;
 if(tags.length)config.links[id]=tags;else delete config.links[id];
 config.tags=[...new Set([...config.tags,...tags])];
 const json=JSON.stringify(config);
 await tx.$executeRaw`UPDATE integration.health_game_config SET version=version+1,config=${json}::jsonb WHERE id=1`;
 await tx.$executeRaw`INSERT INTO integration.health_game_audit(version,actor,config) VALUES(${row.version+1},${actor},${json}::jsonb)`;
}
function installLegacy(service){
 const original=service.prototype.save;
 service.prototype.save=async function(body,actor){
 return this.db.$transaction(async tx=>{
 await tx.$queryRawUnsafe('SELECT true FROM (SELECT pg_advisory_xact_lock(261111053)) l');
 const [before]=await tx.$queryRawUnsafe('SELECT config,version FROM integration.health_game_config WHERE id=1 FOR UPDATE');
 if(before.version!==body?.version)throw new ConflictException('設定已更新');
 const local=Object.create(this);
 local.db=new Proxy(tx,{get(target,key){return key==='$transaction'?fn=>fn(tx):Reflect.get(target,key);}});
 const saved=await original.call(local,body,actor);
 for(const name of body.tags)await tx.$executeRaw`INSERT INTO integration.topic_tag(name) VALUES(${name}) ON CONFLICT DO NOTHING`;
 for(const id of new Set([...Object.keys(before.config.links),...Object.keys(body.links)])){
 const old=before.config.links[id]??[],next=body.links[id]??[];
 for(const name of old.filter(t=>!next.includes(t)))await tx.$executeRaw`DELETE FROM integration.topic_tag_assignment WHERE resource_key=${id} AND tag_id=(SELECT id FROM integration.topic_tag WHERE name=${name})`;
 for(const name of next.filter(t=>!old.includes(t)))await tx.$executeRaw`INSERT INTO integration.topic_tag_assignment SELECT ${id},id,'editor',${actor} FROM integration.topic_tag WHERE name=${name} ON CONFLICT DO NOTHING`;
 }
 return saved;
 },{timeout:20000});
 };
}
module.exports={mirror,installLegacy};
