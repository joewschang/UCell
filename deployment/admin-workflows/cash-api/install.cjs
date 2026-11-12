'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const expected={
  'member/formal-member-application.service':'ba0a3706714d4f7945eef328987d7903c190d14e616d7c01330e755f6906839d',
  'member/member.controller':'71a72d6a4df7d0c0a0420c04730c6c395d77ef08f131a53d036ca37a818e5709',
  'member/admin-formal-member-application.controller':'8dd02c6932eda0114c4d6f769480bf89f686ec56a70ba3bab4ab780b66ad6ade',
  'member/formal-kyc-document.service':'ad38cc90b3b677905ed7fdc5bdcbaf7560a4eb3f2ee3a07f4e7cdcf4c9bb56aa',
  'member/formal-enrollment.service':'13fdc59cfa74dbf363bf8ac2749c42732a62f3381b99ac9ea3c2a6b8d1755021',
  'member/member.module':'98b08e3afdfea5383b07e85b8051bb5a16eb4d454da88acd2c2e8f5c13f2ab11',
  'member/paper-reconfirmation':'501040eacf8b9446a19f99ca10cbc179bbae6532099d2b332748ff8c3ca48498',
  'nhi-payout/nhi-payout.service':'417794df65da5c89c7a6db5847cf49f8f1be30f04c92fd540c34a96f2e5b3a8a',
  'nhi-payout/entity-payee':'e4227a9aa4db8779fe917cacc1f47f00673d30ac9c35e5539407fcccd2cbbb29'
};
function patch(unit,s){
  assert.equal(crypto.createHash('sha256').update(s).digest('hex'),expected[unit],unit);
  function replace(a,b){assert.equal(s.split(a).length,2,unit+' '+a);s=s.replace(a,()=>b);}
  function before(a,b){replace(a,b+'\n'+a);}
  const core='require("./formal-payout-method")';
  if(unit==='member/member.module') replace('controllers: [','controllers: [require("./formal-payout-method.controller").FormalPayoutMethodController,');
  if(unit==='member/formal-member-application.service'){
    for(const [key,code] of [['bankCode','CODE'],['bankAccount','ACCOUNT'],['accountHolder','HOLDER']]){
      const error=key==='accountHolder'?'FORMAL_ACCOUNT_HOLDER_REQUIRED':'FORMAL_BANK_'+code+'_REQUIRED';
      replace('this.required(input.'+key+", '"+error+"')","(input."+key+"?.trim() ?? '')");
    }
    const stop="if (current && current.status !== 'DRAFT'";
    before(stop,'const method=current?(await '+core+'.lockChoice(tx,current.formalMemberApplicationId)).method:"BANK_TRANSFER";'+core+'.requireBank(normalized,method);');
    for(const expression of ['this.view(current,unchanged,current.snapshots[0].version)','this.view(current, normalized, current.snapshots[0].version)','this.view(application, normalized, version)'])
      replace('return '+expression+';', 'return {...'+expression+',payoutMethod:method};');
    before('const paperReference = this.required','const method=input.payoutMethod??"BANK_TRANSFER";'+core+'.requireBank(normalized,method);');
    replace('const safeRequest = { paperReference,','const safeRequest = { ...(method==="COMPANY_CASH"?{payoutMethod:method}:{}), paperReference,');
    before("const required = normalized.applicantType === 'LEGAL_ENTITY'",'if(method==="COMPANY_CASH")await '+core+'.setChoice(tx,app.formalMemberApplicationId,method,actorId);');
    replace("sourceChannel: 'ADMIN_PAPER', paperApplicationReference: paperReference, legalEntityId }, requestId","sourceChannel: 'ADMIN_PAPER', payoutMethod:method,paperApplicationReference: paperReference, legalEntityId }, requestId");
    before("if ((0, spouse_review_policy_1.requiresSpouseCrossLineReview)(app) && app.crossLineReviewStatus !== 'CLEAR')",'const choice=await '+core+'.payoutChoice(db,applicationId);const fields=await '+core+'.snapshotBankErrors(db,applicationId,choice);if(fields.length)return {ready:false,codes:fields};');
    replace("required.filter(type => status.get(type) !== 'REVIEWED')",core+".requiredEvidence(required,choice.method).filter(type => status.get(type) !== 'REVIEWED')");
    replace("const required = ['IDENTITY_FRONT', 'IDENTITY_BACK', 'BANKBOOK_COVER', 'SIGNED_APPLICATION_AGREEMENT'];","const required = "+core+".requiredEvidence(['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER','SIGNED_APPLICATION_AGREEMENT'],choice.method);");
    before("const updated = await tx.formalMemberApplication.update({ where: { formalMemberApplicationId: applicationId }, data: { status: 'APPROVED'",'await '+core+'.saveApprovedMethod(tx,app);');
    before("const previous = app.snapshots[0];",'const method=(await '+core+'.lockChoice(tx,applicationId)).method;'+core+'.requireBank(normalized,method);');
    before("paperRound: application.sourceChannel",'...await '+core+'.methodFields(this.db,applicationId),');
  }
  if(unit==='member/formal-enrollment.service'){
    replace('return { payload: (0, spouse_review_policy_1.stripSpouseData)','return {payoutMethod:(await '+core+'.payoutChoice(this.db,applicationId)).method, payload: (0, spouse_review_policy_1.stripSpouseData)');
    replace('application: application ? { id: application.formalMemberApplicationId','application: application ? { payoutMethod:(await '+core+'.payoutChoice(this.db,application.formalMemberApplicationId)).method,id: application.formalMemberApplicationId');
    before("const docs = await tx.formalApplicationDocument.findMany(",'const choice=await '+core+'.lockChoice(tx,applicationId);const fields=await '+core+'.snapshotBankErrors(tx,applicationId,choice);if(fields.length)throw new common_1.ConflictException({code:fields[0]});');
    replace("if (['IDENTITY_FRONT', 'IDENTITY_BACK', 'BANKBOOK_COVER'].some","if ("+core+".requiredEvidence(['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER'],choice.method).some");
  }
  if(unit==='member/formal-kyc-document.service'){
    replace('return { applicationId,contractRenewal,paperReviewed:','const method=(await '+core+'.payoutChoice(this.db,applicationId)).method;return {applicationId,payoutMethod:method,contractRenewal,paperReviewed:');
    replace("? [...REQUIRED_WEB] : []","? "+core+".requiredEvidence(REQUIRED_WEB,method) : []");
  }
  if(unit==='member/paper-reconfirmation'){
    before("const contract = new database_1.PiiCryptoService().decrypt(s.payloadCiphertext","const method=(await "+core+".payoutChoice(tx,id)).method; input={...input,documents:"+core+".requiredEvidence(input.documents,method)};");
    before("if (action === 'submit' && r.status === 'SUBMITTED')",'const choice=await '+core+'.payoutChoice(tx,id);r.documents='+core+'.requiredEvidence(r.documents,choice.method);');
    before("if(action===\"submit\") await require(\"./contract-renewal\")","if(action==='submit')"+core+".requireBank(f,choice.method);");
  }
  if(unit==='member/member.controller'||unit==='member/admin-formal-member-application.controller'){
    const dto=unit==='member/member.controller'?'FormalMemberDraftDto':'AdminPaperFormalApplicationDto';
    for(const key of ['bankCode','bankAccount','accountHolder']){
      const anchor='], '+dto+'.prototype, "'+key+'", void 0);';
      const i=s.lastIndexOf('__decorate([',s.indexOf(anchor));
      assert(i>=0&&s.split(anchor).length===2);
      s=s.slice(0,i)+s.slice(i).replace('__decorate([','__decorate([(0,class_validator_1.ValidateIf)((_,v)=>v!=null&&v!==""),');
    }
    if(dto==='AdminPaperFormalApplicationDto'){
      const anchor='class AdminFormalUpdateDto extends ';
      before(anchor,'__decorate([(0,class_validator_1.IsOptional)(),(0,class_validator_1.IsIn)(["BANK_TRANSFER","COMPANY_CASH"])],AdminPaperFormalApplicationDto.prototype,"payoutMethod",void 0);');
      replace("['representativePersonId', 'paperApplicationReference']","['representativePersonId', 'paperApplicationReference','payoutMethod']");
    }
  }
  if(unit.startsWith('nhi-payout/')) s=require('./finance.cjs').patch(unit,s);
  return s;
}
function install(root,release){
  for(const [unit] of Object.entries(expected)){
    const file=path.join(root,unit+'.js'),s=patch(unit,fs.readFileSync(file,'utf8'));
    fs.writeFileSync(file,s);
  }
  for(const name of ['formal-payout-method','formal-payout-method.controller']) fs.copyFileSync(path.join(release,name+'.js'),path.join(root,'member',name+'.js'));
}
module.exports={patch,install,expected};
if(require.main===module)install('/app/apps/api/dist/modules',__dirname);
