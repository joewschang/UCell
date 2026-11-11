const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const [scope,root]=process.argv.slice(2);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const asset=html.match(/src="(\/assets\/[^"]+\.js)"/)[1];
let s=fs.readFileSync(path.join(root,asset),'utf8');
function edit(from,to,count=1){
  if(s.split(from).length!==count+1)throw Error('Unknown '+scope+' view: '+from);
  s=s.replaceAll(from,()=>to);
}
const jsx=scope==='admin'?'e':'r';
const name=code=>jsx+'.jsx(UcSponsorName,{code:'+code+'})';
function children(value,code,count=1){edit('children:'+value+'}', 'children:['+value+','+name(code)+']}',count);}
if(scope==='admin'){
  edit('value:ye,onChange:Pe}),e.jsxs("label"', 'value:ye,onChange:Pe}),e.jsx(UcManualCheck,{file:en.IDENTITY_BACK,current:ye,disabled:D,apply:value=>{Pe(value);un(true)}}),e.jsxs("label"');
  edit('g(!1)}})]},B))','g(!1)}}),B==="sponsorBallNo"&&'+name('c[B]??H')+']},B))');
  edit('t(j.text??"")','t(j.text??"",j.registeredAddress??"")');
  edit('document:U,onText:O=>b(Y=>({...Y,[U.id]:O}))','document:U,onText:(text,address)=>b(Y=>({...Y,[U.id]:text,["address:"+U.id]:address}))');
  edit('U=T.find(O=>O.type==="IDENTITY_BACK")','U=T.find(O=>O.type===(r.applicantType==="LEGAL_ENTITY"?"REPRESENTATIVE_IDENTITY_BACK":"IDENTITY_BACK"))??T.find(O=>O.type==="IDENTITY_BACK")');
  edit('children:Hy.map(z)','children:[...Hy.map(z),U&&e.jsx(UcAddressHint,{address:S["address:"+U.id],current:l.communicationAddress,apply:H?value=>B(form=>({...form,communicationAddress:value})):undefined})]');
  edit('i.paperApplicationNo]}),e.jsxs("div",{className:"form"', 'i.paperApplicationNo]}),e.jsx(UcPaperCheck,{row:i},i.source+":"+i.sourceId),e.jsxs("div",{className:"form"');
  for(const [end,code] of [['b(null)}})]}),e.jsxs("label",{children:["修改原因"','o'],['sponsorBallNo:O.target.value.toUpperCase()}))})]','l.sponsorBallNo'],['ee=>N(ee.target.value.toUpperCase())})]','R']]){
    edit(end,end.replace('})]','}),'+name(code)+']'));
  }
  edit('label:L("新推薦 Ball"),children:e.jsx("input",{value:U,onChange:D=>k(D.target.value.toUpperCase())})','label:L("新推薦 Ball"),children:[e.jsx("input",{value:U,onChange:D=>k(D.target.value.toUpperCase())}),'+name('U')+']');
  for(const [value,fallback] of [['y.sponsorBallNo','尚未確認'],['D.sponsorBallNo','尚未確認推薦球'],['A.sponsorBallNo','尚未指定']])children(value+'??"'+fallback+'"',value);
  edit('h.candidate.sponsorBallNo??"尚未確認"," · 推薦序號 "', 'h.candidate.sponsorBallNo??"尚未確認",'+name('h.candidate.sponsorBallNo')+'," · 推薦序號 "');
}else{
  edit('r.jsx("strong",{children:$})]}),oe>0','r.jsx("strong",{children:[$,!i&&'+name('V.data?T:null')+']})]}),oe>0');
  edit('V.data.displayLabel+"（公司推薦）"]','V.data.displayLabel+"（公司推薦）",'+name('T')+']');
  edit('children:QR(R)})]},I','children:[QR(R),I==="sponsorBallNo"&&'+name('R')+']})]},I');
  edit('children:eA[i.fields[y]]||i.fields[y]||"未填寫"}','children:[eA[i.fields[y]]||i.fields[y]||"未填寫",y==="sponsorBallNo"&&'+name('i.fields[y]')+']}');
  children('e.sponsorBallNo','e.sponsorBallNo',2);
  edit('d.sponsorBallNo??"待確認"]','d.sponsorBallNo??"待確認",'+name('d.sponsorBallNo')+']');
  edit('children:e.code}),"。在商品','children:[e.code,'+name('e.code')+']}),"。在商品');
}
let helpers=fs.readFileSync(path.join(__dirname,'views.mjs'),'utf8').replaceAll('export function','function');
if(scope==='member')helpers=helpers.slice(0,helpers.indexOf('function addressViews'));
const react=scope==='admin'?'f':'h',client=scope==='admin'?'Tn':'q';
const init='const UcSponsorName=holderView('+react+','+jsx+'.jsx,'+client+',"'+scope+'");'+(scope==='admin'?'const {AddressHint:UcAddressHint,PaperCheck:UcPaperCheck,ManualCheck:UcManualCheck}=addressViews(f,e.jsx,Tn,Vl);':'');
// Inject after the framework and before rendering root (which may be synchronous).
const anchor=scope==='admin'?'function ql(':'function tA(';
edit(anchor,helpers+'\n'+init+'\n'+anchor);
const next='/assets/address-holder-'+crypto.createHash('sha256').update(s).digest('hex').slice(0,12)+'.js';
fs.writeFileSync(path.join(root,next),s);
fs.writeFileSync(path.join(root,'index.html'),html.replace(asset,next));
