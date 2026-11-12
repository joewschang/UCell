'use strict';
const {prepare} = require('../../site/prepare.cjs');
const {createContractRenewal} = require('./renewal.cjs');
const hints = [
  ['FORMAL_SIGNATURE_VERSION_CHANGED:"申請資料已有更新，請重新載入並再次簽名"', 'FORMAL_CONTRACT_REFRESH_REQUIRED:"協議已更新，請返回合約與簽名步驟，確認新版協議。",FORMAL_SIGNATURE_VERSION_CHANGED:"申請資料已有更新，請重新載入並再次簽名"']
];
const sites = {
  member: {
    image:'36a685e4afb5d4928da5f5bb1028d483c4d2bcd941dd52b0a1bcb985aa87f19a',
    html:'d16dfc7b0a94e5c826c2842b1ca5b76d52537d6cfc17587aee78ba4a606547cc',
    entry:'member-placement-bd90215b51042012.js',entryHash:'bd90215b51042012ccfaa7d5a00eaa045c833b6fd95b38bedaae2d009c828555',
    transform:require('./member-draft.cjs').patch,
    edits:[...hints,
      ['function Fl({applicationId:e,onReady:t', 'const UCellContractRenewal=('+createContractRenewal.toString()+')(h);function Fl({applicationId:e,onReady:t'],
      ['W=!s&&(ne||(((de=o.data)', 'W=!o.data?.contractRenewal?.requiresRefresh&&!s&&(ne||(((de=o.data)'],
      ['children:"重新讀取簽名狀態"})]}):o.data?W||m?', 'children:"重新讀取簽名狀態"})]}):o.data?.contractRenewal?.requiresRefresh?r.jsx(UCellContractRenewal,{state:o.data.contractRenewal,save:(payload,key)=>q("/member/formal-applications/"+encodeURIComponent(e)+"/contract-renewal",{method:"POST",headers:{"Idempotency-Key":key},body:JSON.stringify(payload)}),reload:o.retry}):o.data?W||m?'],
      ['y(ee instanceof Error?ee.message:"簽名儲存失敗，請重試")', 'y(ee instanceof Error?ee.message:"簽名儲存失敗，請重試");if(["FORMAL_CONTRACT_REFRESH_REQUIRED","CONTRACT_VERSION_NOT_AVAILABLE","FORMAL_SIGNATURE_VERSION_CHANGED"].includes(ee?.code))o.retry()']
    ]
  },
  admin: {
    image:'7d0de266d0e94128ddfaa81dbd8acfc0160cd1d0c456193caa1b662f16714f8c',
    html:'9182a184f6a6a90a51bce94737c3af10f835e6c1ef72849a48bc99dd885fc65b',
    entry:'admin-placement-ea7b299f1148771c.js',entryHash:'80ead5eef68f4276ddb54267a136144459d398c122cfe3ccc1c73eef2b9f9bc4',
    edits:[
      ["Ce.current&&e.jsx(\"p\",{role:\"status\",children:\"正在編輯已保存申請，可修改資料或補傳照片；儲存會更新原申請，不會重複建立。\"})","Ce.current&&e.jsx(\"p\",{role:\"status\",children:\"正在編輯已保存申請，可修改資料或補傳照片；儲存會更新原申請，不會重複建立。\"}),Ce.current&&[\"DRAFT\",\"NEEDS_MORE_INFO\"].includes(Ce.current.status)&&e.jsx(createAdminRenewal,{id:Ce.current.id,disabled:D,updated:Ce.current.version,onRenewed:next=>{const doc=next.current;if(!doc?.id)return;Ce.current={...Ce.current,version:next.version,payloadHash:next.snapshotHash,payload:{...Ce.current.payload,formalContractVersionId:doc.id}};m(doc.id);wt(false);gn(values=>values.filter(type=>type!==\"SIGNED_APPLICATION_AGREEMENT\"));Zt(files=>{const updated={...files};delete updated.SIGNED_APPLICATION_AGREEMENT;return updated;});}},Ce.current.id)"],
      ["disabled:!!Ce.current,value:h,onChange:ue=>m(ue.target.value),children:c.map(ue=>e.jsxs(\"option\",{value:ue.id,children:[Ie(ue.title),\" · \",Ie(ue.version)]},ue.id))","disabled:!!Ce.current,value:h,onChange:ue=>m(ue.target.value),children:[Ce.current&&h&&!c.some(item=>item.id===h)&&e.jsx(\"option\",{value:h,children:\"本申請原協議版本（已封存）\"}),...c.map(ue=>e.jsxs(\"option\",{value:ue.id,children:[Ie(ue.title),\" · \",Ie(ue.version)]},ue.id))]"],
      ['function Q7({id:r})', 'const UCellContractRenewal=('+createContractRenewal.toString()+')(f);'+String(createAdminRenewal)+';function Q7({id:r})'],
      ['t&&D.status==="APPROVED"&&D.sourceChannel==="ADMIN_PAPER"&&e.jsx(Q7,{id:D.id},D.id)',
       't&&["DRAFT","NEEDS_MORE_INFO"].includes(D.status)&&e.jsx(createAdminRenewal,{id:D.id,updated:F.dataUpdatedAt,disabled:Y||j,reload:()=>Promise.all([F.refetch(),W.refetch()])},D.id),t&&D.status==="APPROVED"&&D.sourceChannel==="ADMIN_PAPER"&&e.jsx(Q7,{id:D.id},D.id)']
    ]
  }
};
function createAdminRenewal({id,updated,disabled,reload,onRenewed}) {
  const endpoint='/admin/formal-applications/'+encodeURIComponent(id)+'/contract-renewal';
  const status=Le({queryKey:['formal-contract-renewal',id,updated],queryFn:()=>le(endpoint),retry:false});
  if(status.isError) return e.jsxs('div',{role:'alert',children:['無法確認本案協議版本。',e.jsx('button',{type:'button',onClick:()=>status.refetch(),children:'重新查詢版本'})]});
  return e.jsx(UCellContractRenewal,{admin:true,state:status.data?.data,disabled,save:async(payload,key)=>{const response=await $e(endpoint,payload,key);onRenewed?.({...response.data,current:response.data?.current??status.data?.data?.current});},reload:async()=>{await status.refetch();await reload?.();}});
}
const [app,root,out]=process.argv.slice(2);
prepare(app,root,out,sites[app],'agreement');
