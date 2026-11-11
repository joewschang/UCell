const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.argv[2],index=path.join(root,'index.html'),html=fs.readFileSync(index,'utf8'),asset=html.match(/src="(\/assets\/[^"]+\.js)"/)[1];
let js=fs.readFileSync(path.join(root,asset),'utf8');
function edit(old,value){if(js.split(old).length!==2)throw Error('Unexpected review UI near '+old.slice(0,65));js=js.replace(old,()=>value)}
edit('function J1(r){','function J1(r,documents=[]){');
edit('const o=(Array.isArray((l=t==null?void 0:t.details)',`if(documents.some(doc=>doc.historicalSignature))
 n.SIGNED_APPLICATION_AGREEMENT_MISSING="已保留原申請版本的簽名。目前版本尚待簽署，請在「要求補件並通知會員」帶入補簽名說明。";
 const o=(Array.isArray((l=t==null?void 0:t.details)`);
edit('c("操作未完成："+J1(xe))','c("操作未完成："+J1(xe,W.data?.data??[]))');
edit('function a8({applicationId:r,status:t,disabled:n,onBusy:i,onApproved:o})','function a8({applicationId:r,status:t,disabled:n,onBusy:i,onApproved:o,documents=[]})');
edit('e.jsx(a8,{applicationId:k,status:D.status','e.jsx(a8,{applicationId:k,documents:be,status:D.status');
edit('"核准失敗："+J1(b)','"核准失敗："+J1(b,documents)');
edit('children:["尚未保存會員簽名，不能送出申請或核准。",','children:[be.some(doc=>doc.historicalSignature)?"已保留原簽名，請通知會員核對更新後的申請資料並簽署目前版本。":"尚未保存會員簽名，不能送出申請或核准。",');
edit('onClick:()=>g("請至「我的 → 會員資料／文件與補簽名」','onClick:()=>g((be.some(doc=>doc.historicalSignature)?"您原先簽署的文件已保留。因申請資料已更新，請核對新版資料後重新簽署。":"")+"請至「我的 → 會員資料／文件與補簽名」');
const url='/assets/review-version-'+crypto.createHash('sha256').update(js).digest('hex').slice(0,12)+'.js';
fs.writeFileSync(path.join(root,url),js);fs.writeFileSync(index,html.replace(asset,url));
