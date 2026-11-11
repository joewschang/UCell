'use strict';
const {BadRequestException,ConflictException}=require('@nestjs/common');
const {mirror}=require('./health-tags');
async function init(db){
 await db.$executeRawUnsafe('ALTER TABLE integration.topic_tag ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false');
 await db.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS integration.topic_tag_alias(alias text PRIMARY KEY,tag_id bigint NOT NULL REFERENCES integration.topic_tag(id))');
}
async function manage(tx,body,actor){
 const {action,name,target}=body;
 if(typeof name!=='string'||!/^[-\p{L}\p{N}]{1,18}$/u.test(name))throw new BadRequestException('標籤名稱格式錯誤');
 const [old]=await tx.$queryRaw`SELECT * FROM integration.topic_tag WHERE name=${name} FOR UPDATE`;
 const [alias]=await tx.$queryRaw`SELECT tag_id FROM integration.topic_tag_alias WHERE alias=${name}`;
 if(action==='createTag'){
 if(old||alias)throw new ConflictException('名稱已使用');
 await tx.$executeRaw`INSERT INTO integration.topic_tag(name) VALUES(${name})`;return;
 }
 if(!old)throw new BadRequestException('找不到標籤');
 const affected=await tx.$queryRaw`SELECT resource_key FROM integration.topic_tag_assignment WHERE tag_id=${old.id}`;
 if(action==='archiveTag'||action==='restoreTag'){
 await tx.$executeRaw`UPDATE integration.topic_tag SET archived=${action==='archiveTag'} WHERE id=${old.id}`;
 }else{
 if(typeof target!=='string'||!/^[-\p{L}\p{N}]{1,18}$/u.test(target)||target===name)throw new BadRequestException('目標標籤格式錯誤');
 const [next]=await tx.$queryRaw`SELECT id,archived FROM integration.topic_tag WHERE name=${target}`;
 if(action==='renameTag'){
 const [occupied]=await tx.$queryRaw`SELECT 1 FROM integration.topic_tag_alias WHERE alias=${target}`;
 if(next||occupied)throw new ConflictException('名稱已使用');
 await tx.$executeRaw`UPDATE integration.topic_tag SET name=${target} WHERE id=${old.id}`;
 await tx.$executeRaw`INSERT INTO integration.topic_tag_alias VALUES(${name},${old.id})`;
 }else if(action==='mergeTag'){
 if(!next||next.archived)throw new BadRequestException('請選有效的目標標籤');
 await tx.$executeRaw`INSERT INTO integration.topic_tag_assignment SELECT resource_key,${next.id},source,basis FROM integration.topic_tag_assignment WHERE tag_id=${old.id} ON CONFLICT DO NOTHING`;
 await tx.$executeRaw`INSERT INTO integration.topic_tag_relation SELECT CASE WHEN from_id=${old.id} THEN ${next.id} ELSE from_id END,CASE WHEN to_id=${old.id} THEN ${next.id} ELSE to_id END,kind,source,basis FROM integration.topic_tag_relation WHERE (from_id=${old.id} OR to_id=${old.id}) AND from_id<>${next.id} AND to_id<>${next.id} ON CONFLICT DO NOTHING`;
 await tx.$executeRaw`DELETE FROM integration.topic_tag_relation WHERE from_id=${old.id} OR to_id=${old.id}`;
 await tx.$executeRaw`DELETE FROM integration.topic_tag_assignment WHERE tag_id=${old.id}`;
 await tx.$executeRaw`UPDATE integration.topic_tag_alias SET tag_id=${next.id} WHERE tag_id=${old.id}`;
 await tx.$executeRaw`INSERT INTO integration.topic_tag_alias VALUES(${name},${next.id})`;
 await tx.$executeRaw`DELETE FROM integration.topic_tag WHERE id=${old.id}`;
 }else throw new BadRequestException('無效的操作');
 }
 for(const a of affected)await mirror(tx,a.resource_key,actor);
 const [cfg]=await tx.$queryRawUnsafe('SELECT version,config FROM integration.health_game_config WHERE id=1 FOR UPDATE');
 if(cfg.config.tags.includes(name)&&action!=='restoreTag'){
 cfg.config.tags=cfg.config.tags.filter(t=>t!==name);
 if(['renameTag','mergeTag'].includes(action)&&!cfg.config.tags.includes(target))cfg.config.tags.push(target);
 const json=JSON.stringify(cfg.config);
 await tx.$executeRaw`UPDATE integration.health_game_config SET version=version+1,config=${json}::jsonb WHERE id=1`;
 await tx.$executeRaw`INSERT INTO integration.health_game_audit(version,actor,config) VALUES(${cfg.version+1},${actor},${json}::jsonb)`;
 }
}
module.exports={init,manage};
