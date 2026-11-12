'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {createHash}=require('node:crypto');
const helper=fs.readFileSync(path.resolve(__dirname,'../../../admin/src/features/compensation-period/date-order.mjs'),'utf8').replace(/^export /gm,'');
const hash=data=>createHash('sha256').update(data).digest('hex');
function once(code, from, to) {
  assert.equal(code.split(from).length,2,'Unexpected admin external bundle at '+from.slice(0,75));
  return code.replace(from,()=>to);
}
function patchIntake(code) {
  const funcs=helper.slice(0,helper.indexOf('// The verification API'));
  code=once(code,'function lw(){var Wp',funcs+'\nfunction lw(){const [intakeTime,setIntakeTime]=Z.useState({field:"created_at",descending:true});var Wp');
  code=once(code,'children:Hu.map(C=>k.jsxs("button",','children:orderedByDate(Hu,intakeTime).map(C=>k.jsxs("button",');
  const anchor='k.jsx("div",{className:"intake-queue",';
  code=once(code,anchor,'k.jsx("div",{className:"admin-time-sort-tools",role:"group","aria-label":"最近 200 筆收件排序",children:k.jsx("button",dateButton(intakeTime,"created_at","收件時間",setIntakeTime))}),'+anchor);
  return code;
}
function patchAwards(code) {
  code=once(code,'function Op(){',helper+'\nfunction Op(){');
  code=once(code,'W=ta({queryKey:["award-audit-periods",o],queryFn:()=>ua(Co+aa({page:o})),refetchInterval:6e4}),',
    '[periodOrder,setPeriodOrder]=Ae.useState(null),[caseOrder,setCaseOrder]=Ae.useState(null),'+
    'W=ta({queryKey:["award-audit-periods",periodOrder?"all":o],queryFn:({signal})=>readVerificationPages((n,s)=>ua(Co+aa({page:n}),{signal:s}),o,!!periodOrder,signal),refetchInterval:6e4}),'+
    'periodList=Ae.useMemo(()=>verificationPage(W.data,o,periodOrder),[W.data,o,periodOrder]),');
  code=once(code,'(Z=W.data)','(Z=periodList)');
  code=once(code,'(q=W.data)','(q=periodList)');
  code=once(code,'(Ee=W.data)','(Ee=periodList)');
  code=once(code,'(ae=W.data)','(ae=periodList)');
  code=once(code,'K=ta({queryKey:["award-audit-cases",G,A,z,F],enabled:!!G,queryFn:()=>ua(Co+"/"+G+"/cases"+aa({q:A,status:z,page:F}))}),',
    'K=ta({queryKey:["award-audit-cases",G,A,z,caseOrder?"all":F],enabled:!!G,queryFn:({signal})=>readVerificationPages((n,s)=>ua(Co+"/"+G+"/cases"+aa({q:A,status:z,page:n}),{signal:s}),F,!!caseOrder,signal)}),'+
    'caseList=Ae.useMemo(()=>verificationPage(K.data,F,caseOrder),[K.data,F,caseOrder]),');
  for(const local of ['ge','pt','ht']) code=once(code,'('+local+'=K.data)','('+local+'=caseList)');
  code=once(code,'ne&&Q.jsxs(Q.Fragment,{children:[Q.jsx(Ro,{label:"結算批次",',
    'Q.jsx("div",{className:"admin-time-sort-tools",role:"group","aria-label":"結算批次排序",children:Q.jsx("button",dateButton(periodOrder,"periodEnd","批次截止日",v=>{setPeriodOrder(v);u(1);T(1)}))}),ne&&Q.jsxs(Q.Fragment,{children:[Q.jsx(Ro,{label:"結算批次",');
  code=once(code,'Q.jsx(oa,{query:K}),','Q.jsx(oa,{query:K}),Q.jsx("div",{className:"admin-time-sort-tools",role:"group","aria-label":"差異案件排序",children:[["earnedAt","獎金發生時間"],["due","到期日"]].map(([field,label])=>Q.jsx("button",dateButton(caseOrder,field,label,v=>{setCaseOrder(v);T(1)}),field))}),');
  return code;
}
function externalStamp() {
  return '\n/* external date controls '+hash(helper+patchIntake.toString()+patchAwards.toString()).slice(0,16)+' */\n';
}
function prepareExternal(original, out, manifest) {
  const assets=path.join(out,'overlay','assets');
  const intake=fs.readdirSync(assets).filter(n=>/^DocumentIntakePage-.+\.js$/.test(n));
  assert.equal(intake.length,1,'Expected one renamed document intake chunk');
  const intakePath=path.join(assets,intake[0]);
  fs.writeFileSync(intakePath,patchIntake(fs.readFileSync(intakePath,'utf8')));
  const name='award-verification-85d4e7b6a822aa67.js';
  const award=fs.readFileSync(path.join(original,'assets',name),'utf8');
  assert.equal(hash(award),'85d4e7b6a822aa67a4843432f8274dc31df14925fb94340ac5b97a001dbc5e75');
  const candidate=patchAwards(award), next='award-verification-'+hash(candidate).slice(0,16)+'.js';
  fs.writeFileSync(path.join(assets,next),candidate);
  manifest.replacements['/assets/'+name]='/assets/'+next;
}
module.exports={prepareExternal,externalStamp,patchAwards,patchIntake};
