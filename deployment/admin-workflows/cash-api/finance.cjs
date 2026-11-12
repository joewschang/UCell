'use strict';
const assert=require('node:assert/strict');
function patch(unit,s){
  const core='require("../member/formal-payout-method")';
  function rep(a,b){assert.equal(s.split(a).length,2,unit+' '+a);s=s.replace(a,()=>b);}
  function pre(a,b){rep(a,b+'\n'+a);}
  if(unit.endsWith('entity-payee')){
    pre('const candidate=!p&&await staged(service.db,e.legalEntityId);','const method=await '+core+'.holderMethod(service.db,"LEGAL_ENTITY",e.legalEntityId);');
    rep('return {legalEntityId:e.legalEntityId,memberNo:', 'return {payoutMethod:method,legalEntityId:e.legalEntityId,memberNo:');
    rep('const candidate=await staged(tx,id);','const method=await '+core+'.holderMethod(tx,"LEGAL_ENTITY",id),cash=method==="COMPANY_CASH";const candidate=await staged(tx,id);');
    rep('if((b.useStagedBank||','if(!cash&&(b.useStagedBank||');
    rep('if(b.useStagedBank&&!candidate)','if(!cash&&b.useStagedBank&&!candidate)');
    rep('const details=b.useStagedBank?', 'const details=!cash&&b.useStagedBank?');
    rep("if(!/^\\d{7}$/.test(details.bankBranchCode)||!/^\\d{6,16}$/.test(details.accountNumber)||details.accountName?.trim()!==e.registeredName)","if(!cash&&(!/^\\d{7}$/.test(details.bankBranchCode)||!/^\\d{6,16}$/.test(details.accountNumber)||details.accountName?.trim()!==e.registeredName))");
    rep('const bank=service.pii.encrypt','const bank=cash?current?.bank??null:service.pii.encrypt');
    rep('accountLast:details.accountNumber.slice(-4)','payoutMethod:method,accountLast:cash?current?.accountLast??null:details.accountNumber.slice(-4)');
    rep('await tx.$executeRaw`DELETE FROM membership.holder_remittance_account','if(!cash)await tx.$executeRaw`DELETE FROM membership.holder_remittance_account');
    return s;
  }
  const owner='g.legalEntityId?"LEGAL_ENTITY":"PERSON",g.legalEntityId??g.personId';
  const assertMethod='if((g.payoutMethod??"BANK_TRANSFER")!==await '+core+'.holderMethod(tx,'+owner+')) fail("領款方式已異動，請先核對並重新建立給付。");';
  pre("const rows = await this.db.$queryRawUnsafe('SELECT payload FROM ledger.nhi_payout_profile", 'const method=await '+core+'.holderMethod(this.db,"PERSON",p.personId);');
  rep('return { ...p, profile: this.safeProfile','return { ...p, payoutMethod:method,profile: this.safeProfile');
  pre('if (b.useStagedBank) {','const method=await '+core+'.holderMethod(this.db,"PERSON",p.personId),cash=method==="COMPANY_CASH";');
  rep('if (b.useStagedBank) {','if (!cash && b.useStagedBank) {');
  rep("if (!/^\\d{7}$/.test(b.bankBranchCode ?? '') || !/^\\d{6,16}$/.test(b.accountNumber ?? '') || !b.accountName?.trim())","if (!cash&&(!/^\\d{7}$/.test(b.bankBranchCode ?? '') || !/^\\d{6,16}$/.test(b.accountNumber ?? '') || !b.accountName?.trim()))");
  rep('bank = this.pii.encrypt({ bankBranchCode:', 'bank = cash?null:this.pii.encrypt({ bankBranchCode:');
  rep('accountLast: b.accountNumber.slice(-4)', 'payoutMethod:method, accountLast: cash?null:b.accountNumber.slice(-4)');
  rep("if (b.expectedVersion !== undefined) {","if (cash || b.expectedVersion !== undefined) {");
  pre("if ((prior[0]?.payload?.version ?? null) !== b.expectedVersion)", "if(cash && prior[0]?.payload?.bank){payload.bank=prior[0].payload.bank;payload.accountLast=prior[0].payload.accountLast;}");
  rep("if ((prior[0]?.payload?.version ?? null) !== b.expectedVersion)","if (b.expectedVersion !== undefined && (prior[0]?.payload?.version ?? null) !== b.expectedVersion)");
  rep("if (kind === 'BANK_XLS' && payments.length)","if (kind === 'BANK_XLS' && payments.some(p=>bankGroups.some(g=>g.id===p.payload.groupId)))");
  pre('if (b.stagedVersion !== undefined) {','if(method!==await '+core+'.holderMethod(tx,"PERSON",p.personId))fail("領款方式已變更，請重新核對");');
  rep('if (b.stagedVersion !== undefined) {','if (!cash && b.stagedVersion !== undefined) {');
  rep("await tx.$executeRaw `DELETE FROM membership.holder_remittance_account", "if(!cash)await tx.$executeRaw `DELETE FROM membership.holder_remittance_account");
  pre('const existing = await tx.$queryRawUnsafe(\'SELECT run_id FROM ledger.nhi_payout_person_lock','const method=await '+core+'.holderMethod(tx,entity?"LEGAL_ENTITY":"PERSON",entity?.legalEntityId??person.personId);if(method==="BANK_TRANSFER"&&!p.bank){issues.push(person.memberNo+"：請完成銀行帳戶核對");continue;}');
  rep('memberNo: person.memberNo, profile: p, lines: []','memberNo: person.memberNo, payoutMethod:method,profile: p, lines: []');
  rep("['BANK', 'NHI', 'BANK_XLS'].includes(kind)","['BANK', 'NHI', 'BANK_XLS', 'CASH'].includes(kind)");
  pre("const changed = await require('../person/award-owner.cjs').changedOwner(tx,g);\n                if (changed)",'if(kind!=="NHI"){'+assertMethod+'}');
  rep("if (kind === 'BANK' || kind === 'BANK_XLS') {","const bankGroups=s.groups.filter(g=>g.payoutMethod!=='COMPANY_CASH');\n            if (kind === 'BANK' || kind === 'BANK_XLS' || kind === 'CASH') {\n                if(kind!=='CASH'&&!bankGroups.length)fail('本批均為公司領現，請下載領現清冊。');");
  rep("                content = (0, nhi_calculation_1.csv)([['給付編號', '給付日',", "                if(kind==='CASH'){\n                  const cashGroups=s.groups.filter(g=>g.payoutMethod==='COMPANY_CASH');if(!cashGroups.length)fail('本批沒有公司領現款項。');\n                  content=(0,nhi_calculation_1.csv)([['給付編號','給付日','會員編號','姓名','應領現金','狀態'],...cashGroups.map(g=>[r.reference,r.day,g.memberNo,g.profile.legalName,g.transfer,payments.some(p=>p.payload.groupId===g.id)?'已簽收':'待領取'])]);\n                } else content = (0, nhi_calculation_1.csv)([['給付編號', '給付日',");
  rep("...s.groups.map((g) => { const bank = this.pii.decrypt", "...bankGroups.map((g) => { const bank = this.pii.decrypt");
  rep("const lines = s.groups.map((g) => ({ payoutLineId: g.id, netAmount: g.transfer })), recipients = s.groups.filter", "const lines = bankGroups.map((g) => ({ payoutLineId: g.id, netAmount: g.transfer })), recipients = bankGroups.filter");
  pre("const occurredAt = new Date(b.occurredAt);",'if((b.payoutMethod??"BANK_TRANSFER")!==(g.payoutMethod??"BANK_TRANSFER"))fail("請依領款方式核對；公司領現須填寫簽收憑證。");');
  pre("const changed = await require('../person/award-owner.cjs').changedOwner(tx,g);\n            if (changed)",assertMethod);
  rep("reasonCode: b.status === 'FAILED' ? b.reason : 'NHI_GROUP_CONFIRMED'","reasonCode: b.status === 'FAILED' ? b.reason : g.payoutMethod==='COMPANY_CASH'?'COMPANY_CASH_RECEIVED':'NHI_GROUP_CONFIRMED'");
  rep("'PAYMENT', u.personId, { groupId: g.id, status: b.status", "'PAYMENT', u.personId, { groupId: g.id, payoutMethod:g.payoutMethod??'BANK_TRANSFER', status: b.status");
  rep("history.push({ reference: r.reference, date: r.day,","history.push({ payoutMethod:g.payoutMethod??'BANK_TRANSFER', reference: r.reference, date: r.day,");
  return s;
}
module.exports={patch};
