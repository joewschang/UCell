
'use strict';

const assert = require('node:assert/strict');
const clean = value => JSON.parse(JSON.stringify(value));
const action = 'GPV_ATTRIBUTION_REBASE';

function unlock(plan, directs) {
  const depths = {STARTER:[0,3,4,4,4],ELITE:[0,3,4,5,6],LEADER:[0,3,4,5,7]};
  assert(depths[plan], 'Unknown qualification plan');
  return depths[plan][Math.min(directs,4)];
}

async function inspectVolume(tx, awardPlan, lib, now) {
  const sources = await tx.pvLedger.findMany({where:{pvType:'GPV',eventType:'GPV_CREATED'},orderBy:{eventId:'asc'}});
  const snapshots = await tx.historicalReplaySnapshot.findMany({where:{kind:'GPV',sourceId:{in:sources.map(s=>s.eventId)}}});
  const originals = new Map(snapshots.map(s=>[s.sourceId,lib.verifyReplayEnvelope(s)]));
  assert.equal(originals.size,sources.length);
  const effective=await lib.effectiveGpv(tx,[...originals.values()]);
  const memberships=await tx.binaryTreeMembership.findMany({select:{qualificationId:true,binaryTreeId:true}});
  const treeByBall=new Map(memberships.map(m=>[m.qualificationId,m.binaryTreeId]));
  const projected=[];
  for(const event of sources) {
    const source=originals.get(event.eventId);
    assert.equal(source.inputs.qualificationId,event.qualificationId);
    assert.equal(source.inputs.orderId,event.sourceId);
    assert.equal(source.inputs.lineId,event.sourceLineId);
    assert.equal(source.at,event.occurredAt.toISOString());
    assert(event.amount.eq(source.inputs.volume));
    const net=effective.get(event.eventId);
    const graph=awardPlan.makeGraph(event.qualificationId,event.occurredAt,7,source.evidence);
    const ancestors=lib.historicalSponsorAncestors(graph,event.qualificationId,7);
    const treeId=treeByBall.get(event.qualificationId);
    const binary=[],visited=new Set([event.qualificationId]);
    const parents=new Map(graph.binary.map(b=>[b.childQualificationId,b]));
    for(let edge=parents.get(event.qualificationId);edge;edge=parents.get(edge.parentQualificationId)){
      assert(!visited.has(edge.parentQualificationId),'Binary cycle');visited.add(edge.parentQualificationId);
      assert(treeId&&treeId===treeByBall.get(edge.parentQualificationId),'Binary tree mismatch');
      binary.push({ancestorQualificationId:edge.parentQualificationId,generation:binary.length+1,side:edge.side,amount:net.toString()});
    }
    const theory=[];
    let referralBase=net.mul(0);
    for(const ancestor of ancestors) {
      const g=ancestor.generation, qid=ancestor.qualification_id;
      const state=lib.historicalRecipientState(graph,qid);
      const unlocked=g===1||g<=unlock(state.plan,state.directs);
      const max={STARTER:4,ELITE:6,LEADER:7}[state.plan];assert(max);
      const rate=g===1?lib.snapshotDecimal(source.parameters,'referral.g1.rate',state.plan):
        g<=max?lib.snapshotDecimal(source.parameters,'equalization.rate',state.plan+':G'+g):net.mul(0);
      const base=g===1?net:referralBase;
      if(g===1) referralBase=net.mul(rate);
      theory.push({recipientQualificationId:qid,generation:g,kind:g===1?'REFERRAL':'REFERRAL_MATCHING',baseAmount:base.toString(),rate:rate.toString(),
        amount:(state.active&&unlocked?base.mul(rate):net.mul(0)).toDecimalPlaces(4).toString(),active:state.active,unlocked});
    }
    // Keep the paths used by reports, long chains and later return replay.
    const sourceId=event.eventId;
    const body=clean({version:1,sourceId,asOf:now.toISOString(),net:net.toString(),treeId,graph,binary,theory});
    projected.push({id:sourceId,before:lib.replayHash(source),body,hash:lib.replayHash(body)});
  }
  const recognized=await tx.pvLedger.groupBy({by:['pvType','eventType'],_sum:{amount:true},_count:true});
  const pending=await tx.monthlyRecognitionSchedule.groupBy({by:['status'],_count:true,_sum:{recognizedAmount:true,rpvAmount:true}});
  const overdue=await tx.monthlyRecognitionSchedule.count({where:{dueAt:{lte:now},status:{in:['SCHEDULED','DUE']}}});
  assert.equal(overdue,0,'A repurchase installment needs recognition before the rebase');
  assert(!recognized.some(e=>e.pvType==='RPV'||e.pvType==='EPV'),'Recognition cohort changed; include RPV/EPV recalculation');
  return {projected,summary:{recognized,pending,overdue,sourceCount:projected.length,
    theoryRows:projected.reduce((n,p)=>n+p.body.theory.length,0),binaryRows:projected.reduce((n,p)=>n+p.body.binary.length,0),
    sourceTotal:[...effective.values()].reduce((a,b)=>a.plus(b)).toString()}};
}

async function writeVolume(tx,vol,requestId,correlationId) {
  assert.equal(await tx.auditEvent.count({where:{action,requestId}}),0,'Duplicate volume rebase');
  await tx.auditEvent.createMany({data:vol.projected.map(row=>({
    action,eventCode:action,environment:'PRODUCTION',actorType:'SYSTEM',entityType:'PV_LEDGER',entityId:row.id,
    beforeHash:row.before,afterHash:row.hash,afterData:row.body,requestId,correlationId,
    reasonCode:'CURRENT_SPONSOR_AND_BINARY_TREE_RECALCULATION'}))});
  const written=await tx.auditEvent.findMany({where:{action,requestId},select:{entityId:true,afterHash:true}});
  const expected=new Map(vol.projected.map(row=>[row.id,row.hash]));
  assert.equal(written.length,expected.size);
  for(const row of written)assert.equal(row.afterHash,expected.get(row.entityId));
}
module.exports={inspectVolume,writeVolume};
