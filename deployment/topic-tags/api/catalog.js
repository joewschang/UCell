'use strict';
const {MemberEventsService}=require('../events/events.service');
const {LearningService}=require('../learning/learning.service');
const {createHash}=require('node:crypto');
const basics=[
 ['game','居家腿力與骨骼自我觀察','遊戲','?play=1'],
 ['guide','觀察前，先準備椅子和空間','指南','?read=guide'],
 ['bone','整理身高與回診問題','指南','?read=bone']
];
function copy(value){
 if(typeof value==='string')return /^(https?:|data:|\/)|^[\da-f-]{32,}$/i.test(value)?'':value.replace(/<[^>]*>/g,' ').slice(0,600);
 if(!value||typeof value!=='object')return '';
 return Object.values(value).map(copy).filter(Boolean).join(' ').slice(0,4500);
}
async function inventory(s){
 const db=s.db;
 const [products,contents,events,courses]=await Promise.all([
 db.$queryRawUnsafe('SELECT p.sku,p.display_name,c.published FROM commerce.product_reference p LEFT JOIN commerce.product_content c USING(product_id) WHERE p.is_active'),
 db.publishedContent.findMany({include:{versions:{orderBy:{version:'desc'}}}}),
 db.$queryRawUnsafe("SELECT DISTINCT ON(e.event_code) e.event_code,v.title,v.description,e.status FROM learning.member_event e JOIN learning.member_event_version v USING(member_event_id) WHERE NOT EXISTS(SELECT 1 FROM learning.member_event_deletion d WHERE d.member_event_id=e.member_event_id) ORDER BY e.event_code,(v.status='PUBLISHED') DESC,v.version DESC"),
 db.$queryRawUnsafe("SELECT DISTINCT ON(c.course_code) c.course_code,v.title,v.summary,c.status FROM learning.learning_course c JOIN learning.learning_course_version v USING(learning_course_id) ORDER BY c.course_code,(v.status='PUBLISHED') DESC,v.version DESC")]);
 const rows=basics.map(([id,title,kind])=>({id,title,kind,status:'PUBLISHED',body:title}));
 for(const p of products)rows.push({id:'sku:'+p.sku,title:p.display_name,kind:'商品',status:'PUBLISHED',body:copy(p.published)});
 for(const c of contents){const v=c.versions.find(x=>x.status==='PUBLISHED')??c.versions[0];if(v)rows.push({id:'content:'+c.contentId,title:v.title,kind:'內容',status:c.status,body:v.summary??''});}
 for(const e of events)rows.push({id:'event:'+e.event_code,title:e.title,kind:'活動',status:e.status,body:e.description??''});
 for(const c of courses)rows.push({id:'course:'+c.course_code,title:c.title,kind:'課程',status:c.status,body:c.summary??''});
 for(const r of rows){r.body=[r.title,r.body].join('\n').slice(0,4300);r.hash=createHash('sha256').update(r.body).digest('hex');}
 return rows;
}
async function visible(s,person){
 const config=await s.config();
 const rows=(await s.resources(person,false)).filter(r=>config.config.open||!basics.some(([key])=>key===r.id)).map(r=>({...r,href:r.href.startsWith('?')?'/health/'+r.href:r.href}));
 if(person){
 const [events,courses]=await Promise.all([new MemberEventsService(s.db).memberList(person),new LearningService(s.db).memberList(person)]);
 for(const e of events)rows.push({id:'event:'+e.eventCode,title:e.title,kind:'活動',href:'/events?event='+encodeURIComponent(e.eventCode)});
 for(const c of courses)rows.push({id:'course:'+c.courseCode,title:c.title,kind:'課程',href:'/learning?course='+encodeURIComponent(c.courseCode)});
 }
 return rows;
}
module.exports={inventory,visible};
