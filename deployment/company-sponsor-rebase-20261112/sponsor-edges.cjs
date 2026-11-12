'use strict';

const {createHash}=require('node:crypto');
const operation='ucell-20261112-company-six-direct-sponsors';
const correlationId='a366c524-a064-4593-bedf-9c842233fcd3';
const expected=[
  ['02','3a941689-5099-4c2f-941e-a7a06c735cfa','01','13e0b6a7-8cb5-4dbd-bd24-31197102b94b','3f8667a8-fe39-404e-a05a-67527a6de425',5],
  ['03','201b006a-4064-445d-9436-c88132116adc','01','13e0b6a7-8cb5-4dbd-bd24-31197102b94b','516a9f29-e91f-46da-80f4-2c45381762bc',6],
  ['04','40269a5f-f5b4-4edb-b564-1d36e209056a','02','3a941689-5099-4c2f-941e-a7a06c735cfa','e593bf06-d697-44ad-a98a-871f319060c2',1],
  ['05','144a2874-bc6d-4787-a5e0-766812c9e8fa','02','3a941689-5099-4c2f-941e-a7a06c735cfa','abd7b1ec-7ce8-4fe6-a956-6d92e01250a0',2],
  ['06','b3659e44-c8ca-4a82-82af-dc5c84ffb2c5','03','201b006a-4064-445d-9436-c88132116adc','bf10510e-56da-4714-ab82-8708b0ee52ab',4],
  ['07','92288fb7-9b76-4ebf-9fd6-aa60faa755c4','03','201b006a-4064-445d-9436-c88132116adc','e9571d43-0bea-4bae-a5a9-34b2be2451c1',5]
];
const sql=`SELECT q.ball_no child,q.qualification_id kid,q.kind::text kind,q.current_company_principal_id IS NOT NULL company,q.status::text status,q.active_flag active,
 p.ball_no parent,bp.parent_qualification_id pid,bp.side::text side,bp.effective_from bin_from,bp.effective_to bin_to,bp.binary_placement_id bid,
 m.binary_position_no::text pos,mp.qualification_id heap_parent,
 (SELECT count(*)::int FROM organization.sponsor_relationship sr WHERE sr.child_qualification_id=q.qualification_id) history,
 (SELECT coalesce(max(sr.sponsor_sequence_no),0)::int FROM organization.sponsor_relationship sr WHERE sr.sponsor_qualification_id=bp.parent_qualification_id) previous_max,
 sr.effective_from sponsor_from,sr.effective_to sponsor_to,sr.sponsor_relationship_id sid,sr.sponsor_qualification_id sponsor_pid,sr.sponsor_sequence_no seq
FROM membership.qualification q JOIN organization.binary_placement bp ON bp.child_qualification_id=q.qualification_id AND bp.effective_from<=transaction_timestamp() AND (bp.effective_to IS NULL OR bp.effective_to>transaction_timestamp())
JOIN membership.qualification p ON bp.parent_qualification_id=p.qualification_id
LEFT JOIN organization.binary_tree_membership m ON m.qualification_id=q.qualification_id AND m.effective_from<=transaction_timestamp()
LEFT JOIN organization.binary_tree_membership mp ON mp.binary_tree_id=m.binary_tree_id AND mp.binary_position_no=m.binary_position_no/2 AND mp.effective_from<=transaction_timestamp()
LEFT JOIN organization.sponsor_relationship sr ON sr.child_qualification_id=q.qualification_id
WHERE q.ball_no IN (SELECT 'TW8888888888-'||lpad(n::text,2,'0') FROM generate_series(2,7) n) ORDER BY q.ball_no`;
const fp=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function edgeId(child){const h=fp([operation,child]);return [h.slice(0,8),h.slice(8,12),'8'+h.slice(13,16),'a'+h.slice(17,20),h.slice(20,32)].join('-');}
function assert(ok,msg){if(!ok)throw Error(operation+': '+msg);}
async function inspect(tx){
  const rows=await tx.$queryRawUnsafe(sql);
  assert(rows.length===6,'requires six unique canonical balls and placements');
  let present=0;
  const next=new Map();
  for(const [i,r] of rows.entries()){
    const [child,kid,parent,pid,bid,seq]=expected[i];
    assert(r.child==='TW8888888888-'+child &&r.kid===kid &&r.parent==='TW8888888888-'+parent && r.pid===pid &&r.bid===bid &&r.heap_parent===pid &&r.pos===String(+child),'canonical placement drift '+child);
    assert(r.kind==='COMPANY_BOOTSTRAP'&&r.company&&r.status==='EFFECTIVE'&&r.active&&r.bin_to===null,'company qualification drift '+child);
    assert(r.side===(+child%2===0?'LEFT':'RIGHT'),'side drift '+child);
    if(r.history===1){
      assert(r.sid===edgeId(child)&&r.sponsor_pid===pid&&r.sponsor_to===null&&r.seq===seq,'unexpected sponsor history '+child); present++;
    } else {
      assert(r.history===0,'ambiguous sponsor history '+child);
      const planned=(next.get(pid)??r.previous_max)+1;assert(planned===seq,'sponsor sequence changed '+child);next.set(pid,planned);
    }
  }
  assert(present===0||present===6,'incomplete original batch');
  const all=await tx.$queryRawUnsafe('SELECT child_qualification_id kid,sponsor_qualification_id pid,sponsor_relationship_id sid,sponsor_sequence_no seq,effective_from::text start,effective_to::text finish FROM organization.sponsor_relationship ORDER BY child_qualification_id');
  const current=await tx.$queryRawUnsafe('SELECT child_qualification_id kid,sponsor_qualification_id pid FROM organization.sponsor_relationship WHERE effective_from<=transaction_timestamp() AND (effective_to IS NULL OR effective_to>transaction_timestamp())');
  const graph=new Map(current.map(e=>[e.kid,e.pid]));
  assert(current.length===graph.size,'multiple active parents');
  const original=rows.map(r=>graph.get(r.kid));
  assert(original.every((p,i)=>present?p===rows[i].pid:p===undefined),'active state inconsistent');
  for(const r of rows)graph.set(r.kid,r.pid);
  const done=new Set();
  for(const id of graph.keys()){let p=id;const path=new Set();while(graph.has(p)&&!done.has(p)){assert(!path.has(p),'cycle');path.add(p);p=graph.get(p);}for(const x of path)done.add(x);}
  const target=new Set(rows.map(r=>r.kid));
  const unaffectedHash=fp(all.filter(r=>!target.has(r.kid)));
  return {present,rows,unaffectedHash,activeCount:current.length};
}
function evidence(rows){return rows.map((r,i)=>({ball:r.child,childQualificationId:r.kid,binaryParent:r.parent,sponsorQualificationId:r.pid,binaryPlacementId:r.bid,side:r.side,relationId:edgeId(expected[i][0]),sponsorSequenceNo:expected[i][5]}));}
async function verify(tx,baseline){
  const after=await inspect(tx);
  assert(after.present===6,'six live edges required');
  const ids=evidence(after.rows);
  const audit=await tx.auditEvent.findUnique({where:{auditEventId:correlationId}});
  assert(audit?.eventCode==='COMPANY_SPONSORS_ALIGNED'&&audit.requestId===operation&&audit.afterHash===fp(ids)&&audit.afterData?.unaffectedHash,'matching audit receipt missing');
  const [{atomic}]=await tx.$queryRawUnsafe(`SELECT count(distinct effective_from)=1 AND bool_and(effective_from=created_at) AS atomic FROM organization.sponsor_relationship WHERE child_qualification_id IN(SELECT qualification_id FROM membership.qualification WHERE ball_no IN(SELECT 'TW8888888888-'||lpad(n::text,2,'0') FROM generate_series(2,7) n))`);assert(atomic,'non-atomic effective time');
  if(baseline){
    assert(after.unaffectedHash===baseline.unaffectedHash,'unrelated sponsor history changed');
    assert(after.activeCount===baseline.activeCount+6-baseline.present,'active edge count delta');
  }
  return {operation,created:baseline?6-baseline.present:0,activeCount:after.activeCount,effectiveFrom:after.rows[0].sponsor_from,relations:ids};
}
async function apply(tx, options={}){
  const [{isolation}]=await tx.$queryRawUnsafe("SELECT current_setting('transaction_isolation') isolation");
  assert(isolation==='serializable','outer transaction must be Serializable');
  await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended($1,0))::text",operation);
  // Same row locks used by OrganizationService.allocateSponsorSequence; include children in stable order.
  const locked=await tx.$queryRawUnsafe("SELECT qualification_id FROM membership.qualification WHERE ball_no IN(SELECT 'TW8888888888-'||lpad(n::text,2,'0') FROM generate_series(1,7) n) ORDER BY qualification_id FOR UPDATE");
  assert(locked.length===7,'qualification lock set changed');
  const before=await inspect(tx);
  if(before.present)return verify(tx,before);
  assert(!(await tx.auditEvent.findUnique({where:{auditEventId:correlationId}})),'preexisting receipt without relations');
  for(const [i,r] of before.rows.entries()){
    const [child,,,,,seq]=expected[i];
    const [{next}]=await tx.$queryRawUnsafe('SELECT coalesce(max(sponsor_sequence_no),0)+1 AS next FROM organization.sponsor_relationship WHERE sponsor_qualification_id=$1::uuid',r.pid);
    assert(next===seq,'sequence allocation conflict '+child);
    await tx.$executeRawUnsafe('INSERT INTO organization.sponsor_relationship (sponsor_relationship_id,sponsor_qualification_id,child_qualification_id,sponsor_sequence_no,effective_from) VALUES($1::uuid,$2::uuid,$3::uuid,$4::int,transaction_timestamp())',edgeId(child),r.pid,r.kid,seq);
  }
  const ids=evidence(before.rows);
  await tx.auditEvent.create({data:{auditEventId:correlationId,actorType:'SYSTEM',action:'ALIGN_COMPANY_SPONSORS_TO_DIRECT_BINARY_PARENTS',eventCode:'COMPANY_SPONSORS_ALIGNED',environment:options.environment||'PRODUCTION',entityType:'COMPANY_SPONSOR_ALIGNMENT',entityId:correlationId,traceId:operation,result:'SUCCESS',beforeData:{untouchedSponsorRowsHash:before.unaffectedHash,previousParents:before.rows.map(r=>({ball:r.child,sponsor:null})),activeCount:before.activeCount},afterData:{relations:ids,unaffectedHash:before.unaffectedHash,effectivePolicy:'FROM_TRANSACTION_TIMESTAMP'},beforeHash:fp(before.rows.map(r=>[r.kid,null])),afterHash:fp(ids),reasonCode:'USER_REQUESTED_COMPANY_SPONSOR_ALIGNMENT',evidenceRef:operation,changedFieldNames:['sponsorQualificationId','sponsorSequenceNo','effectiveFrom'],requestId:operation,correlationId}});
  return verify(tx,before);
}
module.exports={operation,correlationId,inspect,apply,verify};
