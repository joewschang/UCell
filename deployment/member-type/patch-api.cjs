'use strict';
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2];
function fix(file,from,to,count=1){const p=path.join(base,file),s=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');if(s.split(from).length!==count+1)throw Error(file+' unexpected baseline '+from.slice(0,50));fs.writeFileSync(p,s.split(from).join(to));}
fs.appendFileSync(path.join(base,'person/person-maintenance.controller.js'),'\nrequire("./install.cjs")(exports.PersonMaintenanceController);\n');
fix('person/member-directory.js','const personWhere = {','const represented=await db.$queryRawUnsafe("SELECT person_id FROM identity.member_type_current WHERE active_type=\'LEGAL_ENTITY\'"); const personWhere = { personId:{notIn:represented.map(r=>r.person_id)},');
fix('admin-dashboard/admin-dashboard.service.js','const individual = {','const represented=await tx.$queryRawUnsafe("SELECT person_id FROM identity.member_type_current WHERE active_type=\'LEGAL_ENTITY\'"); const individual = {personId:{notIn:represented.map(r=>r.person_id)},');
fix('member/kyc-upload-transport.js',"methods.includes('POST') && (","methods.includes('POST') && (route.url==='/api/v1/admin/persons/member-type/:type/:id' || ");
const p='payout/unified-payable.service.js',f=path.join(base,p),s=fs.readFileSync(f,'utf8'),start=s.indexOf('const byQ = new Map();'),end=s.indexOf('const batch =',start);
if(start<0||end<0)throw Error('unified payout baseline');
fix(p,s.slice(start,end),"const groups=await require('../person/award-owner.cjs').entryGroups(tx,entries);\n            ");
fix(p,'for (const [qid, rows] of byQ)','for (const {qid,rows,historic} of groups)');
fix(p,'detailJson: { payableEntryIds:',"detailJson: { ...(historic?{typeOwner:historic.party+':'+historic.id,payee:historic}:{}),payableEntryIds:");
const nhi='nhi-payout/nhi-payout.service.js';
fix(nhi,'const entity=l.recipient.currentHolderLegalEntity;\n                const person=l.recipient.currentHolder??entity;', "const {entity,person}=await require('../person/award-owner.cjs').lineOwner(tx,l);");
fix(nhi,'entityPayee.changedOwner(tx,g)',"require('../person/award-owner.cjs').changedOwner(tx,g)",2);

fix('nhi-payout/entity-payee.js',"if(entity.status!=='ACTIVE'||entity.membershipState!=='FORMAL_MEMBER')fail('法人尚未生效');","if(entity.status!=='ACTIVE'||entity.membershipState!=='FORMAL_MEMBER'){const [previous]=await db.$queryRaw\x60SELECT 1 AS ok FROM identity.member_type_award_owner WHERE party='LEGAL_ENTITY' AND owner_id=\x24{entity.legalEntityId}::uuid LIMIT 1\x60;if(!previous)fail('法人尚未生效');}".replaceAll('\\x60',String.fromCharCode(96)).replaceAll('\\x24','$'));
fix('payout/recovery-balance.service.js','for (const r of rows) {',"for (const r of await require('../person/award-owner.cjs').recoverableRows(tx,line,rows)) {");
fix(nhi,"const override = (b.adjustments ?? []).find((a) => a.memberNo === g.memberNo);","const override = (b.adjustments ?? []).find((a) => a.memberNo === g.memberNo); if(override && [...groups.values()].some(other=>other!==g && other.memberNo===g.memberNo))fail('同批同一會員編號有兩個所得人，請分開處理個別扣款調整');");
fix('member/member.service.js','alias: person.preferredName, memberNo: person.memberNo,','alias: person.preferredName, memberNo: await require("../person/profile.cjs").publicMemberNo(this.db,personId,person.memberNo),');
fix('member/member.service.js','alias: after.preferredName, memberNo: after.memberNo,','alias: after.preferredName, memberNo: await require("../person/profile.cjs").publicMemberNo(tx,personId,after.memberNo),');
