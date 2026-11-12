const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const hash=value=>createHash('sha256').update(value).digest('hex');
function once(s,a,b){if(s.split(a).length!==2)throw Error('Unrecognized admin anchor: '+a);return s.replace(a,()=>b);}
function assemble(root,payload) {
  const assets=path.join(root,'assets'), previous='binary-overview-57ff8afcc7cbfc3c.js';
  let main=fs.readFileSync(path.join(assets,previous),'utf8');
  if(hash(main)!=='aaabd353894421fe899d3edf8c70c0603e161d0e9a25a1090478bff887f06e24')throw Error('Unrecognized active admin bundle');
  const shared='const UCellReviewHost={React:f,jsx:e,query:Le,auth:Et,get:le,command:$e,ConfirmAction:jn,Field:J,ErrorBox:De,dateTime:Ud};\n';
  main=once(main,'function i8({',shared+fs.readFileSync(path.join(payload,'extension.js'),'utf8')+'\nfunction i8({');
  const reconcile='e.jsx(i8,{applicationId:k,blocked:Y||j,onBusy:ce},"reconcile-"+k)';
  main=once(main,reconcile,'D.enrollmentBundle?e.jsx(UCellGroupReview.EnrollmentReview,{group:D.enrollmentBundle,status:D.status,blocked:Y||j,onBusy:ce,refresh:()=>F.refetch()},D.enrollmentBundle.bundleId):'+reconcile);
  main=once(main,'function a8({applicationId:r,status:t,disabled:n,onBusy:i,onApproved:o,documents=[]})','function a8({applicationId:r,status:t,disabled:n,onBusy:i,onApproved:o,documents=[],groupSize=0})');
  main=once(main,'e.jsx(a8,{applicationId:k,documents:be,status:D.status','e.jsx(a8,{applicationId:k,groupSize:D.enrollmentBundle?.balls.length??0,documents:be,status:D.status');
  main=once(main,'children:g?"核准中，請稍候…":l==="failed"?"重新核准正式會員":"核准正式會員"','children:g?"核准中，請稍候…":groupSize?"核准整組 "+groupSize+" 顆資格":l==="failed"?"重新核准正式會員":"核准正式會員"');
  main=once(main,'children:p?"核准成功，申請人已成為正式會員。":u','children:p?(groupSize?"已完成 "+groupSize+" 顆資格的整組審核。請查看上方安置及生效進度。":"核准成功，申請人已成為正式會員。"):u');
  main=once(main,'documents=[]){var l;const t=r instanceof qn?r.body:null,n={FORMAL_ENROLLMENT_PAYMENT_REQUIRED:', 'documents=[]){var l;const t=r instanceof qn?r.body:null,n={FORMAL_ENROLLMENT_BUNDLE_ROOT_UNPAID:"請先核對本次整組收款。",FORMAL_ENROLLMENT_PAYMENT_REQUIRED:');
  const singleQualificationHint='e.jsx("p",{className:"muted",children:L("核准只建立／更新正式會員身分。法人或自然人要取得新 Ball，仍必須另行購買核准的資格套組並完成 Sponsor／Binary 流程。")})';
  main=once(main,singleQualificationHint,'!D.enrollmentBundle&&'+singleQualificationHint);
  const single='k==="收款"&&e.jsx(gm,{orderId:F.orderId,onBusy:U,readOnly:(r==null?void 0:r.role)==="COMPLIANCE_AUDIT",onConfirmed:()=>void c.invalidateQueries({queryKey:["fulfillment-order"]})},F.orderId)';
  main=once(main,single,'k==="收款"&&(F.enrollmentBundlePayment?e.jsx(UCellGroupReview.EnrollmentBundleReceipt,{bundle:F.enrollmentBundlePayment,orderId:F.orderId,onBusy:U,canConfirm:["SUPER_ADMIN","ORDER_OPS","FINANCE"].includes(r?.role),reload:async()=>{await V.refetch();await c.invalidateQueries({queryKey:["orders"]})}},F.orderId):'+single.slice('k==="收款"&&'.length)+')');
  const css=fs.readFileSync(path.join(payload,'review.css'),'utf8');
  const lazy=[...new Set([...main.matchAll(/import\("\.\/([^"]+\.js)"\)/g)].map(match=>match[1]))];
  if(lazy.length!==3)throw Error('Admin lazy routes changed');
  const chunks=lazy.map(name=>({name,code:fs.readFileSync(path.join(assets,name),'utf8')}));
  const tag=hash([main,css,...chunks.map(chunk=>chunk.code)].join('\n')).slice(0,16);
  const entry='enrollment-review-'+tag+'.js', stylesheet='enrollment-review-'+hash(css).slice(0,16)+'.css';
  for(const {name,code} of chunks){
    const next=name.replace(/-binary-[a-f0-9]+\.js$/,'-review-'+tag+'.js');
    if(next===name)throw Error('Unexpected lazy chunk name');
    fs.writeFileSync(path.join(assets,next),code.replaceAll('./'+previous,'./'+entry));
    main=main.replaceAll('./'+name,'./'+next).replaceAll('"assets/'+name+'"','"assets/'+next+'"');
  }
  fs.writeFileSync(path.join(assets,entry),main);
  fs.writeFileSync(path.join(assets,stylesheet),css);
  function entries(dir){
    for(const file of fs.readdirSync(dir,{withFileTypes:true})){
      const loc=path.join(dir,file.name);
      if(file.isDirectory()){entries(loc);continue;}
      if(!file.name.endsWith('.html'))continue;
      const html=fs.readFileSync(loc,'utf8');
      if(html.includes('/assets/'+previous))fs.writeFileSync(loc,html.replaceAll('/assets/'+previous,'/assets/'+entry).replace('</head>','<link rel="stylesheet" href="/assets/'+stylesheet+'"></head>'));
    }
  }
  entries(root);
  if(!fs.readFileSync(path.join(root,'index.html'),'utf8').includes('/assets/'+entry))throw Error('Missing review entry');
  console.log(JSON.stringify({entry,stylesheet,lazyRoutes:chunks.length}));
}
if(require.main===module)assemble(process.argv[2],process.argv[3]);
module.exports={assemble};
