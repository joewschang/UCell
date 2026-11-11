const fs = require('node:fs'), path = require('node:path');
const [part, root] = process.argv.slice(2);
function change(file,pairs) {
  const target=path.join(root,file);
  let text=fs.readFileSync(target,'utf8');
  for(const [from,to] of pairs){
    if(text.split(from).length!==2)throw Error('Unexpected source in '+file+' at '+from);
    text=text.replace(from,()=>to);
  }
  fs.writeFileSync(target,text);
}
if(part==='api'){
  change('analytics.source.js',[
    ['holder.holderLegalEntityId || !holder.holderPersonId || !personIds.has(holder.holderPersonId)', 'Boolean(holder.holderLegalEntityId) === Boolean(holder.holderPersonId) || (holder.holderPersonId && !personIds.has(holder.holderPersonId))'],
    ['q.currentHolderPersonId === null || q.currentHolderLegalEntityId !== null','q.currentHolderPersonId === null && q.currentHolderLegalEntityId === null']
  ]);
  change('analytics.policy.js',[
    ['human.map(q => q.personId)', 'human.flatMap(q => q.personId ? [q.personId] : [])'],
    ['const prev = last.get(activity.personId);','if (!activity.personId) continue;\n        const prev = last.get(activity.personId);']
  ]);
}else if(part==='admin'){
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const old=index.match(/<script type="module" crossorigin src="([^"]+)"/)[1];
  const next=old.replace('.js','-pnasl.js');
  fs.copyFileSync(path.join(root,old),path.join(root,next));
  change(next,[
    ['[o,l]=f.useState(""),[c,u]=f.useState("sponsor")','[rootChoice,l]=f.useState(""),[c,u]=f.useState("sponsor")'],
    ['+ze({q:p}))}),T=Le({queryKey:["analytics","sonar"', '+ze({q:p}))}),o=rootChoice==="@exact"?(N.data?.data.find(row=>row.label===p)?.id||""):rootChoice,T=Le({queryKey:["analytics","sonar"'],
    ['W.preventDefault(),g(h),l(""),A(null)','W.preventDefault(),g(h.trim().toUpperCase()),l("@exact"),S(null),A(null)'],
    ['l(W.target.value),A(null)','l(W.target.value),S(null),A(null)'],
    ['L("全公司 NASL；選擇球號可看雷達")','"全公司PNASL；選擇球號可看雷達"'],
    ['L(o?"更新 NASL 與此組織雷達":"更新 NASL 快照")','o?"更新 PNASL 與此組織雷達":"更新 PNASL 快照"'],
    ['e.jsx(pt,{query:N}),e.jsx(De,{error:j})','e.jsx(pt,{query:N}),p&&N.isSuccess&&!N.data?.data.length&&e.jsx("p",{role:"status",children:"查無符合的球號，請確認號碼或縮短搜尋前綴。"}),e.jsx(De,{error:j})']
  ]);
  change('index.html',[[old,next],['</head>','<style>.analytics-page .analytics-evidence{color:#193d37}.analytics-page .analytics-stale{color:#603f0b}</style></head>']]);
}
