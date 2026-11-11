'use strict';
// Run inside the API image. This edition classifies the reviewed inventory only.
const assert = require('node:assert/strict');
const {PrismaClient} = require('/app/packages/database/node_modules/@prisma/client');
const db = new PrismaClient();
const edition = 'ai-inventory-20261111-v1';
const products = {
  'TIP-363':['米蕈原料','玄米培養','固態發酵','瓶裝飲品'],
  'TIP-580':['米蕈原料','玄米培養','植物配方','山苦瓜'],
  'TIP-696':['米蕈原料','植物配方','鹿茸粉'],
  'TIP-777':['米蕈原料','植物配方','魚膠原蛋白','單包飲品'],
  'TIP-999':['米蕈原料','玄米培養','固態培養']
};
const videos = {
  '12ca759a-d5ca-4d56-a54e-095e2b5003f1':'TIP-580','ae445710-245f-4121-98bb-a2fa2ed6fe70':'TIP-696','e6c903ba-96c0-46ee-8c8d-e4b84e2e8d8a':'TIP-363',
  'dd7c402a-1c56-4978-a61a-26b9e98952bb':'TIP-580','44b68394-6fbd-4491-bce7-76e5d4f86ccb':'TIP-696','03de419e-9678-4c33-b22d-8abe177d19db':'TIP-363'
};
const entries=[];
const edges=[];
function attach(key,tags,basis,visible=true){entries.push({key,tags,basis,visible});}
function relate(a,b,kind,basis){edges.push({a,b,kind,basis});}
async function seed(tx){
  await tx.$queryRawUnsafe("SELECT true FROM (SELECT pg_advisory_xact_lock(261111052)) l");
  await tx.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS integration.topic_tag (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL UNIQUE)");
  await tx.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS integration.topic_tag_assignment (resource_key text NOT NULL,tag_id bigint NOT NULL REFERENCES integration.topic_tag(id), source text NOT NULL,basis text NOT NULL, PRIMARY KEY(resource_key,tag_id))");
  await tx.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS integration.topic_tag_relation (from_id bigint NOT NULL REFERENCES integration.topic_tag(id),to_id bigint NOT NULL REFERENCES integration.topic_tag(id),kind text NOT NULL,source text NOT NULL,basis text NOT NULL,CHECK(from_id<>to_id),PRIMARY KEY(from_id,to_id,kind))");
  await tx.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS integration.topic_tag_edition (edition text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now(),summary jsonb NOT NULL)");
  const previous=await tx.$queryRaw`SELECT summary FROM integration.topic_tag_edition WHERE edition=${edition}`;
  if(previous.length)return previous[0].summary;
  const [cfg]=await tx.$queryRawUnsafe("SELECT version,config FROM integration.health_game_config WHERE id=1 FOR UPDATE");
  const items=await tx.productReference.findMany({select:{sku:true,isActive:true,displayName:true}});
  assert.deepEqual(items.map(i=>i.sku).sort(),Object.keys(products).sort());
  for(const i of items){
    assert(i.isActive);
    attach('sku:'+i.sku,[i.sku,'TIP系列',...products[i.sku]],i.displayName+' 已發布配方與包裝介紹');
    relate(i.sku,'TIP系列','屬於','商品主檔型號');
    for(const t of products[i.sku])relate(i.sku,t,'產品特色',i.displayName+' 配方與包裝介紹');
  }
  const content=await tx.publishedContent.findMany({include:{versions:{orderBy:{version:'desc'}}}});
  assert.deepEqual(content.map(c=>c.contentId).sort(),Object.keys(videos).sort());
  for(const c of content){
    const v=c.versions.find(v=>v.status==='PUBLISHED')??c.versions[0];
    assert(v.title.includes(videos[c.contentId]));
    attach('content:'+c.contentId,[videos[c.contentId],'產品介紹','TIP系列'],'影片標題與摘要：'+v.title,c.status==='PUBLISHED');
  }
  const event=await tx.$queryRawUnsafe("select e.event_code,v.title,v.description from learning.member_event e join learning.member_event_version v using(member_event_id) where v.status='PUBLISHED' and not exists(select 1 from learning.member_event_deletion d where d.member_event_id=e.member_event_id)");
  assert(event.some(e=>e.event_code==='KH261003'&&e.description.includes('TIP')));
  attach('event:KH261003',['產品介紹','TIP系列','實體說明會'],'已發布活動：產品說明-3，TIP 產品說明會',false);
  attach('game',['居家自我觀察'],'腿力與骨骼自我觀察的四項任務');
  attach('guide',['居家活動','測前準備'],'觀察前，先準備椅子和空間');
  attach('bone',['身高紀錄','回診準備'],'整理身高與回診問題');
  relate('山苦瓜','植物配方','屬於','淨衡順列出的植物原料');
  relate('實體說明會','產品介紹','活動主題','KH261003 的活動內容');
  for(const t of ['腿部肌力','骨骼健康'])relate('居家自我觀察',t,'觀察主題','遊戲的觀察項目');
  relate('測前準備','居家自我觀察','準備作業','遊戲的椅子與空間說明');
  relate('身高紀錄','回診準備','相關用途','整理身高與回診問題');
  relate('固態發酵','玄米培養','相關製程','TIP-363 的公開製程介紹');
  const merged=structuredClone(cfg.config);
  const ids=new Map();
  async function tag(name){
    if(!ids.has(name)){
      const [r]=await tx.$queryRaw`INSERT INTO integration.topic_tag(name) VALUES(${name}) ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id`;
      ids.set(name,r.id);
    }
    return ids.get(name);
  }
  async function assign(key,t,source,basis){
    const id=await tag(t);
    await tx.$executeRaw`INSERT INTO integration.topic_tag_assignment VALUES(${key},${id},${source},${basis}) ON CONFLICT DO NOTHING`;
  }
  for(const t of merged.tags)await tag(t);
  for(const [key,tags] of Object.entries(cfg.config.links))
    for(const t of tags)await assign(key,t,'existing','健康中心既有設定');
  for(const entry of entries){
    for(const t of entry.tags)await assign(entry.key,t,edition,entry.basis);
    if(entry.visible){
      merged.links[entry.key]=[...new Set([...(merged.links[entry.key]??[]),...entry.tags])];
      merged.tags=[...new Set([...merged.tags,...entry.tags])];
    }
  }
  for(const e of edges){
    const a=await tag(e.a),b=await tag(e.b);
    await tx.$executeRaw`INSERT INTO integration.topic_tag_relation VALUES(${a},${b},${e.kind},${edition},${e.basis}) ON CONFLICT DO NOTHING`;
  }
  assert(merged.tags.length<=50);
  const json=JSON.stringify(merged);
  await tx.$executeRaw`UPDATE integration.health_game_config SET config=${json}::jsonb,version=version+1 WHERE id=1`;
  await tx.$executeRaw`INSERT INTO integration.health_game_audit(version,actor,config) VALUES(${cfg.version+1},${edition},${json}::jsonb)`;
  const summary={items:entries.length,tags:ids.size,relations:edges.length,healthConfigVersion:cfg.version+1};
  await tx.$executeRaw`INSERT INTO integration.topic_tag_edition(edition,summary) VALUES(${edition},${JSON.stringify(summary)}::jsonb)`;
  return summary;
}
db.$transaction(seed,{isolationLevel:'Serializable',timeout:30000}).then(console.log).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
