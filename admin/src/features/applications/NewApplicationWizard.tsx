import {useMemo,useState} from 'react';
import {command,get,qs} from '../../lib/api';
import {Person,PlacementPreview,PlanLevel,Qualification,SideCode} from '../../types/domain';
import {Card,ErrorBox,Field,JsonResult,PageHeader,Badge} from '../../components/ui';
import {SearchOption,SearchSelect} from '../../components/SearchSelect';

const plans:{code:PlanLevel;name:string}[]=[
 {code:'STARTER',name:'啟航 / STARTER'},
 {code:'ELITE',name:'菁英 / ELITE'},
 {code:'LEADER',name:'領袖 / LEADER'},
];

export function NewApplicationWizard(){
 const [step,setStep]=useState(1);
 const [person,setPerson]=useState<SearchOption|null>(null);
 const [plan,setPlan]=useState<PlanLevel>('STARTER');
 const [sponsor,setSponsor]=useState<SearchOption|null>(null);
 const [parent,setParent]=useState<SearchOption|null>(null);
 const [side,setSide]=useState<SideCode>('LEFT');
 const [note,setNote]=useState('');
 const [preview,setPreview]=useState<PlacementPreview|null>(null);
 const [created,setCreated]=useState<any>(null);
 const [error,setError]=useState<unknown>(null);
 const [busy,setBusy]=useState(false);

 async function personSearch(q:string){
  const r:any=await get('/admin/persons'+qs({q,take:20}));
  return (r.data as Person[]).map(x=>({id:x.personId,primary:x.legalName,secondary:[x.mobile,x.email,x.personId].filter(Boolean).join(' · '),meta:x}));
 }
 async function qualSearch(q:string){
  const r:any=await get('/admin/qualifications'+qs({q,status:'EFFECTIVE',take:20}));
  return (r.data as Qualification[]).map(x=>({id:x.qualificationId,primary:`Q#${x.qualificationNo??'—'} · ${x.currentHolder?.legalName??'—'}`,secondary:`${x.planLevelCode} · ${x.qualificationId}`,meta:x}));
 }
 async function checkPlacement(){
  if(!sponsor||!parent)return;
  setBusy(true);setError(null);
  try{
   const r:any=await get('/admin/organization/placement-preview'+qs({
    sponsorQualificationId:sponsor.id,binaryParentQualificationId:parent.id,binarySide:side
   }));
   setPreview(r.data);
  }catch(e){setError(e)}finally{setBusy(false)}
 }
 async function createDraft(){
  if(!person||!sponsor||!parent||!preview?.valid)return;
  setBusy(true);setError(null);
  try{
   const r:any=await command('/admin/membership-applications',{
    personId:person.id,
    requestedPlanLevelCode:plan,
    sponsorQualificationId:sponsor.id,
    binaryParentQualificationId:parent.id,
    binarySide:side,
    note:note||undefined
   });
   setCreated(r.data);setStep(5);
  }catch(e){setError(e)}finally{setBusy(false)}
 }

 const steps=['選Person','方案與Sponsor','Binary安置','確認','建立完成'];
 return <>
  <PageHeader title="新增會員申請" subtitle="正式Membership Vertical Slice：推薦與Binary資料在Application Draft建立，Submit/Approve再由後端做最終制度檢核。"/>
  <div className="wizard-steps">{steps.map((x,i)=><span key={x} className={`wizard-step ${step===i+1?'active':''} ${step>i+1?'done':''}`}>{i+1}. {x}</span>)}</div>
  <ErrorBox error={error}/>
  {step===1&&<Card title="1. 選擇既有Person">
   <SearchSelect label="搜尋Person" value={person} onChange={setPerson} search={personSearch}/>
   <p className="muted">若Person不存在，請先至「會員／自然人」建立，避免同一自然人因重複建檔而失去多球治理的一致性。</p>
   <div className="button-row"><button className="primary" disabled={!person} onClick={()=>setStep(2)}>下一步</button></div>
  </Card>}
  {step===2&&<Card title="2. 方案與推薦人">
   <div className="form"><Field label="申請方案"><select value={plan} onChange={e=>setPlan(e.target.value as PlanLevel)}>{plans.map(p=><option key={p.code} value={p.code}>{p.name}</option>)}</select></Field>
   <SearchSelect label="Sponsor Qualification" value={sponsor} onChange={x=>{setSponsor(x);setPreview(null)}} search={qualSearch}/>
   <div className="button-row"><button onClick={()=>setStep(1)}>上一步</button><button className="primary" disabled={!sponsor} onClick={()=>setStep(3)}>下一步</button></div></div>
  </Card>}
  {step===3&&<Card title="3. Binary安置">
   <div className="form"><SearchSelect label="Binary Parent Qualification" value={parent} onChange={x=>{setParent(x);setPreview(null)}} search={qualSearch}/>
   <Field label="Side"><select value={side} onChange={e=>{setSide(e.target.value as SideCode);setPreview(null)}}><option value="LEFT">LEFT</option><option value="RIGHT">RIGHT</option></select></Field>
   <button disabled={!parent||busy} onClick={checkPlacement}>預檢安置合法性</button>
   {preview&&<div className={`callout ${preview.valid?'info':'danger'}`}>
    <strong>{preview.valid?'安置預檢通過':'安置不可用'}</strong>
    <p>下一直推序號：{preview.nextSponsorSequenceNo ?? '—'} {preview.firstThirdLeftRequired&&<Badge tone="warn">第1/3直推左子樹限制</Badge>}</p>
    {!preview.valid&&<p>{preview.message}</p>}
   </div>}
   <div className="button-row"><button onClick={()=>setStep(2)}>上一步</button><button className="primary" disabled={!preview?.valid} onClick={()=>setStep(4)}>下一步</button></div></div>
  </Card>}
  {step===4&&<Card title="4. 確認申請Draft">
   <dl className="detail-grid"><dt>Person</dt><dd>{person?.primary}</dd><dt>Plan</dt><dd>{plan}</dd><dt>Sponsor</dt><dd>{sponsor?.primary}</dd><dt>Binary Parent</dt><dd>{parent?.primary}</dd><dt>Side</dt><dd>{side}</dd><dt>預計直推序號</dt><dd>{preview?.nextSponsorSequenceNo}</dd></dl>
   <Field label="內部備註"><textarea rows={4} value={note} onChange={e=>setNote(e.target.value)}/></Field>
   <div className="callout warning">預檢不等於核准。Approve時Backend會在Serializable/交易流程再次配置永久Sponsor sequence、檢查Binary slot與第1/3直推左子樹規則。</div>
   <div className="button-row"><button onClick={()=>setStep(3)}>上一步</button><button className="primary" disabled={busy} onClick={createDraft}>建立Application Draft</button></div>
  </Card>}
  {step===5&&<div className="success-panel"><h2>Application Draft 已建立</h2><p>Application ID：<span className="mono">{created?.applicationId}</span></p><p>下一步請回「會員申請待審」執行Submit與Approve，不在建立畫面自動核准，以保留營運審查節點。</p><JsonResult value={created}/></div>}
 </>
}
