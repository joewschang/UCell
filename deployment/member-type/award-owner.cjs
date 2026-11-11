'use strict';
const {ConflictException}=require('@nestjs/common');
async function freeze(tx,qid,type,id,no){
 for(const [kind,table,source,recipient] of [
 ['BONUS_AWARD','bonus_award','bonus_award_id','recipient_qualification_id'],
 ['GLOBAL_POOL_AWARD','global_pool_award','global_pool_award_id','qualification_id'],
 ['RPV_UPLINE_AWARD','rpv_upline_award_event','rpv_award_event_id','recipient_qualification_id'],
 ['PAYOUT_LINE','payout_line','payout_line_id','recipient_qualification_id']]){
 await tx.$executeRawUnsafe('INSERT INTO identity.member_type_award_owner(source_type,source_id,qualification_id,party,owner_id,member_no) SELECT $1,'+source+',$2::uuid,$3,$4::uuid,$5 FROM ledger.'+table+' WHERE '+recipient+'=$2::uuid ON CONFLICT DO NOTHING',kind,qid,type,id,no);
 }
}
async function fixed(db,kind,id){
 const [row]=await db.$queryRaw`SELECT party,owner_id AS id,member_no AS no FROM identity.member_type_award_owner WHERE source_type=${kind} AND source_id=${id}::uuid`;
 return row;
}
async function entryGroups(db,entries){
 const groups=new Map();
 const frozen=entries.length?await db.$queryRawUnsafe('SELECT source_type,source_id,party,owner_id AS id,member_no AS no FROM identity.member_type_award_owner WHERE source_id=ANY($1::uuid[])',entries.map(e=>e.sourceId)):[];
 const bySource=new Map(frozen.map(x=>[x.source_type+':'+x.source_id,{party:x.party,id:x.id,no:x.no}]));
 for(const e of entries){
 const historic=bySource.get(e.sourceType+':'+e.sourceId);
 const key=e.qualificationId+':'+(historic?historic.party+':'+historic.id:'');
 if(!groups.has(key))groups.set(key,{qid:e.qualificationId,rows:[],historic});
 groups.get(key).rows.push(e);
 }
 return groups.values();
}
async function lineOwner(db,line){
 let owner=line.detailJson?.payee;
 if(!owner)owner=await fixed(db,'PAYOUT_LINE',line.payoutLineId);
 if(!owner&&line.payableEntries?.length)owner=await fixed(db,line.payableEntries[0].sourceType,line.payableEntries[0].sourceId);
 if(!owner)return {entity:line.recipient.currentHolderLegalEntity,person:line.recipient.currentHolder??line.recipient.currentHolderLegalEntity};
 const entity=owner.party==='LEGAL_ENTITY'?await db.legalEntity.findUnique({where:{legalEntityId:owner.id}}):null;
 const person=entity??await db.person.findUnique({where:{personId:owner.id}});
 if(!person)throw new ConflictException('查無獎金原歸屬人');
 return {entity,person:{...person,memberNo:owner.no}};
}
async function changedOwner(tx,g){
 for(const item of g.lines){
 const line=await tx.payoutLine.findUnique({where:{payoutLineId:item.id},include:{recipient:{include:{currentHolder:true,currentHolderLegalEntity:true}},payableEntries:true}});
 if(!line||line.recipientQualificationId!==item.qualificationId)return true;
 const {entity,person}=await lineOwner(tx,line);
 if(!person||(g.legalEntityId?entity?.legalEntityId!==g.legalEntityId:person.personId!==g.personId))return true;
 }
 return false;
}
module.exports={freeze,entryGroups,lineOwner,changedOwner};
async function recoverableRows(tx, line, rows) {
 if (!rows.length) return rows;
 const owner = await lineOwner(tx, {...line,recipient:await tx.qualification.findUniqueOrThrow({where:{qualificationId:line.recipientQualificationId},include:{currentHolder:true,currentHolderLegalEntity:true}})});
 const current = await tx.qualification.findUniqueOrThrow({where:{qualificationId:line.recipientQualificationId}});
 const recipient = owner.entity?.legalEntityId ?? owner.person?.personId;
 const awardOwners = await tx.$queryRawUnsafe("SELECT source_id,owner_id FROM identity.member_type_award_owner WHERE source_type='BONUS_AWARD' AND qualification_id=$1::uuid",line.recipientQualificationId);
 const fixedOwners = new Map(awardOwners.map(row=>[row.source_id,row.owner_id]));
 return rows.filter(row=>(fixedOwners.get(row.bonusAwardId)??current.currentHolderLegalEntityId??current.currentHolderPersonId)===recipient);
}
module.exports.recoverableRows=recoverableRows;
