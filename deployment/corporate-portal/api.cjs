const fs=require('node:fs'),path=require('node:path'),root=process.argv[2];
function change(file,from,to){
 const f=path.join(root,file),js=fs.readFileSync(f,'utf8');
 if(js.split(from).length!==2)throw Error(file+' unexpected '+from);
 fs.writeFileSync(f,js.replace(from,()=>to));
}
const member='modules/member/member.service.js', enrollment='modules/member/formal-enrollment.service.js', journey='member-journey.cjs';
for(const [name,db] of [['person','this.db'],['after','tx']]){
 const old='return { name: '+name+'.preferredName ?? '+name+'.legalName, alias: '+name+'.preferredName, memberNo: await require("../person/profile.cjs").publicMemberNo('+db+',personId,'+name+'.memberNo)';
 change(member,old,'const entity=await require("../../portal-entity.cjs").currentEntity('+db+',personId); return { name: entity?.name ?? '+name+'.preferredName ?? '+name+'.legalName, alias: '+name+'.preferredName, memberNo: entity?.memberNo ?? await require(\u0022../person/profile.cjs\u0022).publicMemberNo('+db+',personId,'+name+'.memberNo)');
 change(member,'membershipState: '+name+'.membershipState, mobileVerifiedAt:', 'membershipState: entity?.state ?? '+name+'.membershipState, mobileVerifiedAt:');
}
change(member,'rank: row.planLevelCode, active:',"rank: row.kind==='COMPANY_BOOTSTRAP'?'公司球':row.planLevelCode, active:");
change(enrollment,'const [fee, application, packages]','const entity=await require("../../portal-entity.cjs").currentEntity(this.db,personId); const [fee, application, packages]');
const filter="OR:[{applicantType:'INDIVIDUAL'},{sourceChannel:'MEMBER_WEB',applicantType:'LEGAL_ENTITY'}]";
change(enrollment,filter,"...(entity?{legalEntityId:entity.id,applicantType:'LEGAL_ENTITY'}:{"+filter+"})");
change(enrollment,'membershipState: person.membershipState, feeAmount:', 'membershipState: entity?.state ?? person.membershipState, feeAmount:');
change(journey,'const [a]=await db.$queryRawUnsafe(',`const entity=await require('./portal-entity.cjs').currentEntity(db,personId);
 if(entity)p.membershipState=entity.state;
 const [a]=entity?await db.$queryRawUnsafe("SELECT formal_member_application_id AS id,status,source_channel AS source,decision_reason_code AS note FROM identity.formal_member_application WHERE person_id=$1::uuid AND legal_entity_id=$2::uuid AND applicant_type='LEGAL_ENTITY' ORDER BY updated_at DESC LIMIT 1",personId,entity.id):await db.$queryRawUnsafe(`);
