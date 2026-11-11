const identityNames={INDIVIDUAL:'自然人',LEGAL_ENTITY:'法人'};

function IdentityDrawer({subject,onClose,onSaved}) {
  const Drawer=_o;
  const busy=f.useRef(false);
  const path='/admin/persons/member-type/'+subject.type+'/'+encodeURIComponent(subject.id);
  const profile=Le({queryKey:['member-identity-editor',subject.type,subject.id],queryFn:({signal})=>le(path,{signal}),retry:false,refetchOnWindowFocus:false});
  return <Drawer open title="會員身分維護" onClose={()=>{if(!busy.current)onClose();}}>
    <div className="identity-editor">
      {subject.saved&&<p role="status" className="identity-notice">會員身分資料已儲存。</p>}
      {profile.isError?<><De error={profile.error}/><button onClick={()=>profile.refetch()}>重新載入</button></>:
       profile.data?<IdentityForm key={profile.data.data.version} profile={profile.data.data} path={path} lock={busy}
         onSaved={onSaved} onReload={()=>profile.refetch()}/>:<p role="status">正在讀取會員資料…</p>}
    </div>
  </Drawer>;
}

function IdentityForm({profile,path,lock,onSaved,onReload}) {
  const Field=J;
  const company='LEGAL_ENTITY';
  const [target,setTarget]=f.useState(company);
  const [name,setName]=f.useState(profile.type===company?profile.name:'');
  const [registration,setRegistration]=f.useState(profile.registrationNo??'');
  const [file,setFile]=f.useState(null);
  const [reason,setReason]=f.useState('');
  const [confirming,setConfirming]=f.useState(false);
  const [busy,setBusy]=f.useState(false);
  const [error,setError]=f.useState('');
  const key=f.useRef(crypto.randomUUID());
  const needsProof=target===company && (!profile.evidence || registration!==profile.registrationNo);
  const operation=target===profile.type?'更新統編或營登':identityNames[profile.type]+'改為'+identityNames[target];
  function change(setter,value) {
    setter(value);key.current=crypto.randomUUID();setError('');setConfirming(false);
  }
  async function download() {
    try {
      const blob=await Iu(path+'/proof/'+encodeURIComponent(profile.evidence.id));
      const a=document.createElement('a'),url=URL.createObjectURL(blob);
      a.href=url;a.download='營業登記.'+({'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'}[blob.type]??'bin');
      a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(ex){setError(ex.message);}
  }
  async function submit(event) {
    event.preventDefault();
    if(lock.current)return;
    if(!reason.trim()){setError('請填寫異動原因。');return;}
    if(!confirming){setConfirming(true);return;}
    lock.current=true;setBusy(true);setError('');
    try{
      const body={nextType:target,version:profile.version,requestId:key.current,reason:reason.trim(),registrationNo:registration,companyName:name.trim()};
      if(target===company&&file){
        if(file.size>5242880)throw Error('營登文件超過 5 MB，請重新選擇。');
        const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('無法讀取營登文件。'));reader.readAsDataURL(file);});
        body.file={mime:file.type,base64};
      }
      const reply=await Tn(path,{method:'POST',idempotencyKey:key.current,body:JSON.stringify(body),timeoutMs:120000});
      onSaved({type:target,id:reply.data.id??profile.id,saved:true});
    }catch(ex){
      const detail=ex.body?.message??ex.body?.error?.message;
      setError(typeof detail==='string'?detail:ex.message);
    }finally{lock.current=false;setBusy(false);}
  }
  return <>
    <section className="identity-summary"><h3>{profile.name}</h3><p>{identityNames[profile.type]} · {profile.memberNo}</p>
      <dl><dt>{profile.type===company?'法人代表':'本人'}</dt><dd>{profile.representative||'尚未提供'}</dd>
      <dt>個人證件末四碼</dt><dd>{profile.personalIdLast4??'尚未提供'}</dd>
      {profile.type===company&&<><dt>公司統編</dt><dd>{profile.registrationNo||'尚未提供'}</dd></>}</dl>
      {profile.evidence&&<button type="button" onClick={download}>下載已登錄營登</button>}
    </section>
    <form onSubmit={submit}><fieldset disabled={busy}><legend>異動內容</legend>
      <Field label="異動項目"><select value={target} onChange={e=>change(setTarget,e.target.value)}>
        <option value={company}>{profile.type===company?'補登營登或更正公司統編':'自然人改為法人'}</option>
        {profile.type===company&&<option value="INDIVIDUAL">法人改為目前代表人（自然人）</option>}</select></Field>
      <div hidden={target!==company}>
        <Field label="公司登記名稱"><input required={target===company} maxLength={150} value={name} readOnly={profile.type===company} onChange={e=>change(setName,e.target.value)}/></Field>
        <Field label="公司統一編號"><input required={target===company} disabled={target!==company} value={registration} maxLength={8} pattern="[0-9]{8}" inputMode="numeric" placeholder="8 位數字" onChange={e=>change(setRegistration,e.target.value)}/></Field>
        <Field label={needsProof?'上傳營業登記文件（必填）':'更換營業登記文件（選填）'} hint="PDF、JPG 或 PNG，每份最多 5 MB。">
          <input required={needsProof} type="file" accept="application/pdf,image/jpeg,image/png" onChange={e=>{const next=e.target.files?.[0];if(next?.size>5242880){e.target.value='';change(setFile,null);setError('營登文件超過 5 MB，請重新選擇。');}else change(setFile,next);}}/></Field>
      </div>
      <Field label="異動原因"><textarea required rows={2} maxLength={300} value={reason} onChange={e=>change(setReason,e.target.value)}/></Field>
      <p className="identity-note">{target===profile.type?'營登依此次確認的公司統編歸檔。':'保留會員編號及 '+profile.balls+' 顆球的球號與位置。新身分自儲存時承接，已產生的獎金維持原歸屬。'}</p>
      {confirming&&<p role="status">請確認為「{profile.name}」執行「{operation}」{target===company?'，公司統編 '+registration:''}。</p>}
      <div className="button-row"><button className="primary" type="submit" disabled={busy}>{busy?'儲存中…':confirming?'確認儲存':'檢查異動內容'}</button>
      {confirming&&<button type="button" onClick={()=>setConfirming(false)}>返回編輯</button>}</div>
    </fieldset></form>
    {error&&<div role="alert"><p>{error}</p><button type="button" onClick={onReload}>重新載入會員資料</button></div>}
  </>;
}

function CorporateSummary({entity,selected,choose,personQuery}) {
  const reps=entity.representatives??[];
  return <section className="identity-summary corporate-summary"><h3>法人資料</h3>
    <dl><dt>公司名稱</dt><dd>{entity.legalName}</dd><dt>法人會員編號</dt><dd>{entity.memberNo}</dd>
    <dt>統一編號</dt><dd>{entity.registrationNo||'尚未提供'}</dd><dt>登記地址</dt><dd>{entity.registeredAddress||'尚未提供'}</dd>
    <dt>身分狀態</dt><dd><Gs status={entity.status} label={zp(entity)}/></dd><dt>經營代表人</dt><dd>{reps.map(rep=>rep.legalName).join('、')||'尚未登錄'}</dd></dl>
    {reps.length>1&&<J label="選擇要操作的代表人帳號"><select value={selected?.personId??''} onChange={event=>choose(reps.find(rep=>rep.personId===event.target.value)??null)}>
      <option value="">請選擇代表人</option>{reps.map(rep=><option key={rep.personId} value={rep.personId}>{rep.legalName} · {Md(rep)}</option>)}</select></J>}
    {selected&&<p role="status">會員資料維護、商品推薦歸因與帳號安全對應「{selected.legalName}」的帳號。</p>}
    {!reps.length&&<p>尚未登錄經營代表人，請先補上代表人以使用帳號功能。</p>}
    {personQuery.isError&&<><De error={personQuery.error}/><button onClick={()=>personQuery.refetch()}>重新讀取代表人帳號</button></>}
  </section>;
}
