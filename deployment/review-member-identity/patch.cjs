'use strict';
const fs=require('node:fs'),path=require('node:path'),root='/app/apps/api/dist/modules';
function edit(file,before,after,n=1){
 const f=path.join(root,file),text=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
 if(text.split(before).length!==n+1)throw Error(file+' unexpected occurrences of '+before.slice(0,85));
 fs.writeFileSync(f,text.split(before).join(after));
}
const service='member/formal-member-application.service.js',enroll='member/formal-enrollment.service.js',docs='member/formal-kyc-document.service.js';
edit('person/convert.cjs','return {saved:true,id:toEntity?eid:pid,',"await require('../member/review.cjs').sync(tx,pid,eid,next); return {saved:true,id:toEntity?eid:pid,");
edit('person/profile.cjs','return {saved:true};\n });',"if((await require('../member/review.cjs').company(tx,p.personId))?.id===id)await require('../member/review.cjs').sync(tx,p.personId,id,'LEGAL_ENTITY'); return {saved:true};\n });");
edit('person/install.cjs',"await require('./migration.cjs').migrate(this.db);","await require('./migration.cjs').migrate(this.db); await this.db.$transaction(tx=>require('../member/review.cjs').migrate(tx),{timeout:60000});");
edit(service,'const normalized = this.normalize(input);\n        if (normalized.applicantType',`const linked=await require('./review.cjs').company(this.db,personId);
        const normalized=linked ? require('./review.cjs').corporatePayload(this.normalize({...input,applicantType:'INDIVIDUAL'}),linked) : this.normalize(input);
        if (!linked && normalized.applicantType`);
edit(service,'sourceChannel: current?.sourceChannel', '...(linked?{legalEntityId:linked.id}:{}),sourceChannel: current?.sourceChannel');
edit(service,"if (app.applicantType !== 'INDIVIDUAL')",`if(app.applicantType==='LEGAL_ENTITY' && app.sourceChannel==='MEMBER_WEB'){
          const mapped=await require('./review.cjs').company(db,app.personId);
          const [proof]=await db.$queryRawUnsafe('SELECT 1 AS ok FROM identity.member_type_evidence WHERE legal_entity_id=$1::uuid AND registration_no=$2 LIMIT 1',app.legalEntityId,app.legalEntityRegistrationNo);
          if(!proof||mapped?.id!==app.legalEntityId)return {ready:false,codes:['CORPORATE_REGISTRATION_REQUIRED']};
        } else if (app.applicantType !== 'INDIVIDUAL')`);
edit(service,"let applicationName = '';","let applicationName = '',representativeName = '';");
edit(service,'applicationName = String(row.applicantType', "representativeName=String(payload.representativeLegalName??'').trim();applicationName = String(row.applicantType");
edit(service,"? row.person.legalName : null, displayMemberNo", "? (representativeName||row.person.legalName) : null, displayMemberNo");
edit(service,'person: application.person,',"person: application.applicantType==='LEGAL_ENTITY'&&payload.representativeLegalName?{...application.person,legalName:payload.representativeLegalName}:application.person,");
edit(enroll,"where: { personId, applicantType: 'INDIVIDUAL' }, select:", "where: { personId, OR:[{applicantType:'INDIVIDUAL'},{sourceChannel:'MEMBER_WEB',applicantType:'LEGAL_ENTITY'}] }, select:");
edit(enroll,"|| app.applicantType === 'LEGAL_ENTITY')","|| (app.applicantType === 'LEGAL_ENTITY' && app.sourceChannel!=='MEMBER_WEB'))");
edit(docs,"app.sourceChannel === 'MEMBER_WEB' && app.applicantType === 'INDIVIDUAL'", "app.sourceChannel === 'MEMBER_WEB'");
edit(docs,"|| app.applicantType !== 'INDIVIDUAL'))","|| (app.applicantType !== 'INDIVIDUAL' && app.sourceChannel!=='MEMBER_WEB')))");

edit('member/formal-document-supplement.js',"|| app.applicantType !== 'INDIVIDUAL' ||","|| (app.applicantType !== 'INDIVIDUAL' && app.sourceChannel!=='MEMBER_WEB') ||");
edit(service,'const paper = await tx.formalMemberApplication.findFirst(',`const lockedCompany=await require('./review.cjs').company(tx,personId);
                if((linked?.id??null)!==(lockedCompany?.id??null)||linked?.number!==lockedCompany?.number)throw new common_1.ConflictException({code:'MEMBER_IDENTITY_CHANGED',message:'會員身分已更新，請重新開啟申請資料。'});
                const paper = await tx.formalMemberApplication.findFirst(`);
edit('member/member.controller.js',"(0, class_validator_2.IsIn)(['INDIVIDUAL']),","(0, class_validator_2.IsIn)(['INDIVIDUAL','LEGAL_ENTITY']),");
edit('member/member.controller.js',"enum: ['INDIVIDUAL'], description: 'Applicant type; omitted input defaults to INDIVIDUAL.'","enum: ['INDIVIDUAL','LEGAL_ENTITY'], description: 'Corporate web drafts require a verified member-type correction.'");
