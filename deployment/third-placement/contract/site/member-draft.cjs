'use strict';
const assert = require('node:assert/strict');

// Compiled into the existing profile form. Keep fields and selected files mounted while changing agreement versions.
function useDraftAgreement() {
  const [prompt,setPrompt] = h.useState(null);
  const [acceptedHash,setAcceptedHash] = h.useState('');
  const [notice,setNotice] = h.useState('');
  const opened = h.useRef(null);
  const confirmed = h.useRef(null);
  const endpoint = id => '/member/formal-applications/'+encodeURIComponent(id)+'/contract-renewal';

  async function save({body, key, application, original, edited, renewal, confirmEdit, available}) {
    if (!application) return gR(body,key);
    const id=application.id;
    if (application.status && !['DRAFT','NEEDS_MORE_INFO'].includes(application.status))
      throw new Error('申請已送審，請返回申請進度查看已送資料。');
    const state=await q(endpoint(id));
    const ownVersion=renewal?.id===id ? renewal.version : undefined;
    // A contract-only renewal advances exactly one revision. Intervening edits require the form's comparison flow.
    const expected=ownVersion===body.expectedVersion+1 ? ownVersion : body.expectedVersion;
    if (Number.isInteger(expected) && state.version!==expected)
      throw new Error('申請已由其他畫面更新。請保留輸入，核對最新已存資料後再儲存。');
    if (!state.current) throw new Error('目前無法取得有效的正式會員協議，請稍後重試。');
    if (state.requiresRefresh) {
      setPrompt({id,state,kind:state.canRefresh===false?'staff':'unsigned'}); return null;
    }
    if (state.preservedSignature) {
      const changed=edited && Object.entries(body).some(([field,value])=>
        !['formalContractVersionId','expectedVersion'].includes(field) && String(original?.[field]??'').trim()!==String(value??'').trim());
      if (!changed) return {id,version:state.version};
      if (state.canRefresh!==true) {
        setPrompt({id,state,kind:'staff'}); return null;
      }
      if (!confirmEdit || prompt?.state.snapshotHash!==state.snapshotHash || acceptedHash!==state.current.contentHash) {
        const matches=doc=>doc.id===state.current.id && doc.contentHash===state.current.contentHash && !!doc.content?.trim();
        const current=available.find(matches)??(await pR()).find(matches);
        if(!current)throw new Error('新版協議已更新，請重新取得有效的協議全文。');
        setPrompt({id,state:{...state,current},kind:'signed'}); return null;
      }
      await mR(state.current.id,crypto.randomUUID());
    }
    const result=await gR({...body,formalContractVersionId:state.current.id,expectedVersion:expected},key);
    setPrompt(null); setNotice(''); setAcceptedHash('');
    return result;
  }

  function panel(onRenewed,busy,setError) {
    if (!prompt) return notice ? r.jsx('p',{role:'status',children:notice}) : null;
    const {id,state,kind}=prompt;
    if (kind==='staff') return r.jsx('p',{role:'status',children:'本案需由承辦人處理協議版本。已填資料與已選文件仍保留在本頁。'});
    if (kind==='signed') return r.jsxs('section',{className:'card',children:[
      r.jsx('h4',{children:'儲存修改後需要重新簽名'}),
      r.jsx('p',{children:'原申請已簽署舊版協議。若要儲存本次資料修改，請先閱讀新版協議。繼續後須依修改後的申請重新簽名。'}),
      r.jsx(Ul,{contract:state.current,accepted:acceptedHash===state.current.contentHash,disabled:busy,onAccept:()=>setAcceptedHash(state.current.contentHash)}),
      r.jsx('button',{type:'submit',name:'confirmAgreementEdit',disabled:busy||acceptedHash!==state.current.contentHash,children:'同意新版並儲存修改，重新簽名'}),
    ]});
    return r.jsx(UCellContractRenewal,{state,disabled:busy,
      save:async(payload,key)=>{
        const result=await q(endpoint(id),{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(payload)});
        confirmed.current={id,hash:state.snapshotHash,result};
      },
      reload:async()=>{
        if(confirmed.current?.id===id && confirmed.current.hash===state.snapshotHash){
          onRenewed(id,confirmed.current.result);confirmed.current=null;
          setPrompt(null);setNotice('已切換至新版協議。請儲存本頁修改，再前往簽名。');setError('');return;
        }
        try {
          const latest=await q(endpoint(id));
          if(latest.requiresRefresh){setPrompt({id,state:latest,kind:latest.canRefresh===false?'staff':'unsigned'});return;}
          setPrompt(null);setError('申請已更新。請核對最新已存資料，再儲存本頁修改。');
        } catch(e){setError(e instanceof Error?e.message:'無法查詢協議版本，請重試。');}
      },
    });
  }
  return {save,panel,opened};
}

function patch(code) {
  function once(before,after) {
    assert.equal(code.split(before).length,2,'Unexpected member draft anchor: '+before.slice(0,90));
    code=code.replace(before,()=>after);
  }
  const form='function AT({onSubmitted:e,onSaved:t,onReadyChange:n,draftOnly:i=!1,initial:s}={}){';
  once(form,String(useDraftAgreement)+';'+form.replace('initial:s','initial:s,renewedDraft,onDraftRenewed')+'const agreement=useDraftAgreement();');
  once('S.current=!0,$(B=>{var le;', 'S.current=!0,agreement.opened.current=s.draft,$(B=>{var le;');
  once('version:_.draft.version}),B||($(le=>', 'version:_.draft.version}),agreement.opened.current=_.draft,B||($(le=>');
  once('expectedVersion:(E==null?void 0:E.version)??((ke=s==null?void 0:s.draft)==null?void 0:ke.version)','expectedVersion:E?.version??agreement.opened.current?.version??s?.draft?.version');
  once('async function Z(B){var ke;if(B.preventDefault(),u)', 'async function Z(B){var ke;const confirmEdit=B.nativeEvent?.submitter?.name==="confirmAgreementEdit";if(B.preventDefault(),u)');
  once('ce=await gR({...H,...ee},w.current);j(ce)', 'ce=await agreement.save({body:{...H,...ee},key:w.current,application:s?.application??E,original:agreement.opened.current?.payload,edited:k,renewal:renewedDraft,confirmEdit,available:c.data});if(!ce)return;j(ce)');
  const label='r.jsx("h3",{children:"會員資料與文件"}),r.jsxs("p",{children:[r.jsx("span",{className:"required-star"';
  once(label,label.replace(',r.jsxs("p"',',agreement.panel((id,row)=>{j({id,version:row.version});w.current=crypto.randomUUID();onDraftRenewed?.(id,row);},u,p),r.jsxs("p"'));
  once('function Xm(){const [bundleEditor','function Xm(){const [renewedDraft,setRenewedDraft]=h.useState(null);const [bundleEditor');
  once('r.jsx(AT,{initial:S,draftOnly:!0,onReadyChange:n','r.jsx(AT,{initial:S,renewedDraft,onDraftRenewed:(id,row)=>{setRenewedDraft({id,version:row.version});e.retry();},draftOnly:!0,onReadyChange:n');
  once('function Fl({applicationId:e,onReady:t,onSaved:n,readContract:', 'function Fl({applicationId:e,onReady:t,onSaved:n,onDraftRenewed,readContract:');
  once('r.jsx(Fl,{applicationId:I,onReady:s,onPdfChange:setPdfKey', 'r.jsx(Fl,{applicationId:I,onReady:s,onDraftRenewed:row=>{setRenewedDraft({id:I,version:row.version});e.retry();},onPdfChange:setPdfKey');
  const save='save:(payload,key)=>q("/member/formal-applications/"+encodeURIComponent(e)+"/contract-renewal",{method:"POST",headers:{"Idempotency-Key":key},body:JSON.stringify(payload)})';
  once(save,save+'.then(row=>{onDraftRenewed?.(row);return row;})');
  // A linked legal entity returns a corporate application from this same member endpoint.
  once('n.applicantType!=="INDIVIDUAL"||!(n.identityDocumentNumberMasked===null', '!["INDIVIDUAL","LEGAL_ENTITY"].includes(n.applicantType)||!(n.identityDocumentNumberMasked===null');
  return code;
}
module.exports={patch};
