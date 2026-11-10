"""Build a minimal overlay against the extracted, pinned production API."""
from pathlib import Path
import sys, shutil
src,out=map(Path,sys.argv[1:3])
modules=Path('app/apps/api/dist/modules')
files={}
def change(file,old,new,count=1):
    key=modules/(file+'.js')
    s=files.get(key) or (src/key).read_text('utf-8')
    if s.count(old)!=count:raise ValueError(f'{file}: expected {count} occurrences of {old[:75]}, got {s.count(old)}')
    files[key]=s.replace(old,new)
ready='../common/utils/placement-ready'
change(ready,'JOIN identity.person p ON p.person_id=q.current_holder_person_id','LEFT JOIN identity.person p ON p.person_id=q.current_holder_person_id LEFT JOIN identity.legal_entity entity ON entity.legal_entity_id=q.current_holder_legal_entity_id')
change(ready,"AND p.membership_state='FORMAL_MEMBER'", "AND (p.membership_state='FORMAL_MEMBER' OR (entity.membership_state='FORMAL_MEMBER' AND entity.status='ACTIVE'))")
tree='binary-tree/binary-tree.service'
change(tree,'currentHolder: { memberNo }, binaryTreeMembership: null','OR: [{currentHolder:{memberNo}},{currentHolderLegalEntity:{memberNo}}], binaryTreeMembership: null')
for var in ('q','target'):
    change(tree,'!'+var+'.currentHolderPersonId ||','(!'+var+'.currentHolderPersonId && !'+var+'.currentHolderLegalEntityId) ||')
change(tree,'holder: target.currentHolderPersonId,','holder: target.currentHolderPersonId ?? target.currentHolderLegalEntityId,',2)
place='organization/tree-placement'
change(place,'!q.currentHolderPersonId ||','(!q.currentHolderPersonId && !q.currentHolderLegalEntityId) ||')
change(place,'history[0].holderPersonId !== q.currentHolderPersonId','history[0].holderPersonId !== q.currentHolderPersonId || history[0].holderLegalEntityId !== q.currentHolderLegalEntityId')
change(place,"owner.ownerType !== 'MEMBER' || owner.personId !== q.currentHolderPersonId","owner.ownerType !== (q.currentHolderLegalEntityId ? 'LEGAL_ENTITY' : 'MEMBER') || owner.personId !== q.currentHolderPersonId || owner.legalEntityId !== q.currentHolderLegalEntityId")
change(place,"ownerType: 'MEMBER', personId: q.currentHolderPersonId,", "ownerType: q.currentHolderLegalEntityId ? 'LEGAL_ENTITY' : 'MEMBER', ...(q.currentHolderLegalEntityId ? {legalEntityId:q.currentHolderLegalEntityId} : {personId:q.currentHolderPersonId}),")
change(place,'holderHistoryId: history[0].holderHistoryId, personId: q.currentHolderPersonId','holderHistoryId: history[0].holderHistoryId, ...(q.currentHolderLegalEntityId ? {legalEntityId:q.currentHolderLegalEntityId} : {personId:q.currentHolderPersonId})')
change(place,'await tx.foundingOccupationEvidence.create(','''if(q.currentHolderLegalEntityId){
            await tx.$executeRaw`INSERT INTO organization.founding_occupation_evidence(founding_occupation_evidence_id,binary_tree_id,position_no,qualification_id,initial_legal_entity_id,company_sponsor_qualification_id,sponsor_relationship_id,actual_sponsor_sequence_no,effective_at,evidence_hash)
              VALUES(gen_random_uuid(),${tree.binaryTreeId}::uuid,${position.positionNo},${q.qualificationId}::uuid,${q.currentHolderLegalEntityId}::uuid,${sponsor.sponsorQualificationId}::uuid,${sponsor.sponsorRelationshipId}::uuid,${sponsor.sponsorSequenceNo},${data.effectiveFrom},${evidenceHash})`;
        } else await tx.foundingOccupationEvidence.create(''')
read='binary-tree/binary-tree-read.service'
change(read,'tx.foundingOccupationEvidence.findFirst({ where:', 'tx.foundingOccupationEvidence.findFirst({ select:{actualSponsorSequenceNo:true}, where:')
change(read,'owner.personId ?? owner.companyPrincipalId','owner.personId ?? owner.legalEntityId ?? owner.companyPrincipalId')
resolver='qualification/sponsor-resolver.service'
change(resolver,'kind: true, currentHolderPersonId: true','kind: true, currentHolderPersonId: true, currentHolderLegalEntityId:true')
change(resolver,"!row.currentHolderPersonId && row.kind !== 'COMPANY_BOOTSTRAP'","!row.currentHolderPersonId && !row.currentHolderLegalEntityId && row.kind !== 'COMPANY_BOOTSTRAP'")
change(resolver,'sponsorOwnerPersonId: row.kind', 'sponsorOwnerLegalEntityId:row.currentHolderLegalEntityId, sponsorOwnerPersonId: row.kind')
change(resolver,'const { sponsorOwnerPersonId, ...publicEvidence }','const { sponsorOwnerPersonId,sponsorOwnerLegalEntityId, ...publicEvidence }')
change('order/order.service','if (sponsorEvidence && !sponsorEvidence.sponsorOwnerPersonId)', '''if(sponsorEvidence?.sponsorOwnerLegalEntityId){
                        await tx.$executeRaw`INSERT INTO organization.qualification_sponsor_selection_evidence(qualification_sponsor_selection_evidence_id,qualification_id,attribution_referrer_qualification_id,selected_sponsor_qualification_id,selected_sponsor_owner_legal_entity_id,selected_by_person_id,selected_at,source,policy_version,correlation_id)
                          VALUES(gen_random_uuid(),${qualificationId}::uuid,${sponsorEvidence.sponsorQualificationId}::uuid,${sponsorEvidence.sponsorQualificationId}::uuid,${sponsorEvidence.sponsorOwnerLegalEntityId}::uuid,${personId}::uuid,${now},'MANUAL_INPUT',${sponsorEvidence.ruleVersion},${correlationId}::uuid)`;
                    } else if (sponsorEvidence && !sponsorEvidence.sponsorOwnerPersonId)''')
change('qualification/pending-sponsor','selected_sponsor_owner_person_id,selected_by_person_id','selected_sponsor_owner_person_id,selected_sponsor_owner_legal_entity_id,selected_by_person_id')
change('qualification/pending-sponsor','${owner}::uuid,${actorId}', '${owner}::uuid,${resolved.sponsorOwnerLegalEntityId??null}::uuid,${actorId}')
change('member/member-read.service','if (q.currentHolderPersonId !== personId)','if (q.currentHolderPersonId && q.currentHolderPersonId !== personId)')
change('auth/qualification-access.service', "roleCode: 'PRIMARY_OPERATING_REPRESENTATIVE',","roleCode: 'PRIMARY_OPERATING_REPRESENTATIVE', verifiedAt:{not:null},")
change('member/member.service', "roleCode: 'PRIMARY_OPERATING_REPRESENTATIVE', effectiveFrom:", "roleCode: 'PRIMARY_OPERATING_REPRESENTATIVE', verifiedAt:{not:null}, effectiveFrom:",2)
nhi='nhi-payout/nhi-payout.service'
change(nhi,'"use strict";','"use strict";\nconst entityPayee=require("./entity-payee");')
change(nhi,'async profile(memberNo) {','async profile(memberNo) {\n        const entity=await entityPayee.lookup(this.db,memberNo);if(entity)return entityPayee.view(this,entity);')
change(nhi,'async saveProfile(memberNo, b, u) {\n        this.finance(u);','async saveProfile(memberNo, b, u) {\n        this.finance(u);if(await entityPayee.lookup(this.db,memberNo))return entityPayee.save(this,memberNo,b,u,day);')
change(nhi,'recipient: { include: { currentHolder: true } }','recipient: { include: { currentHolder: true, currentHolderLegalEntity: true } }')
change(nhi,'const person = l.recipient.currentHolder;', '''const entity=l.recipient.currentHolderLegalEntity;
                const person=l.recipient.currentHolder??entity;''')
change(nhi,"const rows = await tx.$queryRawUnsafe('SELECT payload FROM ledger.nhi_payout_profile WHERE person_id=$1::uuid', person.personId);\n                const p = rows[0]?.payload;",'''const p=entity ? await entityPayee.profile(tx,entity.legalEntityId) : (await tx.$queryRawUnsafe('SELECT payload FROM ledger.nhi_payout_profile WHERE person_id=$1::uuid',person.personId))[0]?.payload;''')
change(nhi,'personId: person.personId, memberNo: person.memberNo','...(entity ? {legalEntityId:entity.legalEntityId} : {personId:person.personId}), memberNo: person.memberNo')
change(nhi,'if (g.personId !== person.personId)','if (g.personId !== person.personId || g.legalEntityId !== entity?.legalEntityId)')
change(nhi,'holder: l.recipient.currentHolderPersonId','holder: l.recipient.currentHolderPersonId ?? l.recipient.currentHolderLegalEntityId')
change(nhi,'await tx.qualification.count({ where: { qualificationId: { in: g.lines.map((l) => l.qualificationId) }, NOT: { currentHolderPersonId: g.personId } } })','await entityPayee.changedOwner(tx,g)',2)
start='async member(personId) { const runs'
change(nhi,start,'''async member(personId) { const now=new Date();
      const entities=await this.db.legalEntityRepresentative.findMany({where:{personId,roleCode:'PRIMARY_OPERATING_REPRESENTATIVE',verifiedAt:{not:null},effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}],legalEntity:{status:'ACTIVE',membershipState:'FORMAL_MEMBER'}},select:{legalEntityId:true}});
      const ids=entities.map(r=>r.legalEntityId);
      const runs''')
change(nhi,"AND snapshot->'groups' @> $1::jsonb ORDER BY", "AND (snapshot->'groups' @> $1::jsonb OR EXISTS(SELECT 1 FROM jsonb_array_elements(snapshot->'groups') g WHERE g->>'legalEntityId'=ANY($2::text[]))) ORDER BY")
change(nhi,'JSON.stringify([{ personId }])','JSON.stringify([{ personId }]),ids')
change(nhi,'(x) => x.personId === personId','(x) => x.personId === personId || ids.includes(x.legalEntityId)')
bank='qualification/holder-bank'
change(bank,"if (o.type === 'PERSON') {","""if(o.type==='LEGAL_ENTITY'){
      const p=await require('../nhi-payout/entity-payee').profile(tx,o.id);
      if(p)return {version:p.version,bank:p.bank,profile:p};
    }
    if (o.type === 'PERSON') {""")
change(bank,'if (previous.profile) {','''if (previous.profile && o.type==='LEGAL_ENTITY'){
          const e=await tx.legalEntity.findUniqueOrThrow({where:{legalEntityId:o.id},select:{registeredName:true}});
          if(input.accountName.trim()!==e.registeredName)throw new common_1.ConflictException('帳戶戶名須與法人登記名稱一致');
          const payload={...previous.profile,version,bank,accountLast:input.accountNumber.slice(-4)};
          await tx.$executeRaw`UPDATE ledger.nhi_payout_entity_profile SET payload=${JSON.stringify(payload)}::jsonb,updated_by=${actor.personId}::uuid,updated_at=now() WHERE legal_entity_id=${o.id}::uuid`;
        } else if (previous.profile) {''')
scope="{ OR:[{currentHolderPersonId:personId},{currentHolderLegalEntity:{status:'ACTIVE',membershipState:'FORMAL_MEMBER',representatives:{some:{personId,roleCode:'PRIMARY_OPERATING_REPRESENTATIVE',verifiedAt:{not:null},effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]}}}}] }"
change('member/member-growth.service', "where: { currentHolderPersonId: personId, status:", "where: { ..."+scope+", status:")
change('order/order-payment-context.service', 'qualification: { currentHolderPersonId: personId }', 'qualification: '+scope)
change('order/order.service', "where: { currentHolderPersonId: personId, status: 'EFFECTIVE' }", "where: { ..."+scope.replace('lte:now','lte:new Date()').replace('gt:now','gt:new Date()')+", status: 'EFFECTIVE' }")
change('member/member-explain.service','select: { currentHolderPersonId: true }','select: { currentHolderPersonId:true,currentHolderLegalEntityId:true }')
change('member/member-explain.service','return !systemBall && ball?.currentHolderPersonId',"""if(!systemBall && ball?.currentHolderLegalEntityId && holders.length===1 && holders[0].holderLegalEntityId===ball.currentHolderLegalEntityId){
            return !!await db.legalEntityRepresentative.count({where:{legalEntityId:ball.currentHolderLegalEntityId,personId,verifiedAt:{not:null},roleCode:'PRIMARY_OPERATING_REPRESENTATIVE',effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}],legalEntity:{status:'ACTIVE',membershipState:'FORMAL_MEMBER'}}});
        }
        return !systemBall && ball?.currentHolderPersonId""")
for file,column,count in [('period-bonus-source','kind',3),('period-projection-sources','kind',1),('period-projection-sources','owner_type',7)]:
    change('analytics/'+file,column+"='MEMBER'",column+" IN ('MEMBER','LEGAL_ENTITY')",count)
workflow='qualification/qualification-workflow.service'
change(workflow,'current.holderPersonId !== qualification.currentHolderPersonId','current.holderPersonId !== qualification.currentHolderPersonId || current.holderLegalEntityId !== qualification.currentHolderLegalEntityId')
change(workflow,"current.ownerType !== expected","(current.ownerType !== expected && !(expected==='MEMBER' && current.ownerType==='LEGAL_ENTITY'))")
change(workflow,'currentHolderPersonId: null, currentCompanyPrincipalId: companyId','currentHolderLegalEntityId:null, currentHolderPersonId: null, currentCompanyPrincipalId: companyId')
change(workflow,'currentHolderPersonId: wf.receivingPersonId','currentHolderLegalEntityId:null, currentHolderPersonId: wf.receivingPersonId')
change(workflow,'currentHolderPersonId: companyHolderPersonId','currentHolderLegalEntityId:null, currentHolderPersonId: companyHolderPersonId')
for key,s in files.items():
    f=out/key;f.parent.mkdir(parents=True,exist_ok=True);f.write_text(s,encoding='utf-8')
shutil.copyfile(Path(__file__).with_name('entity-payee.js'),out/modules/'nhi-payout/entity-payee.js')
