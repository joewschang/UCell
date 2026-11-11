function DailyGreetingAdmin() {
  const PageTitle=jt, Panel=ae;
  const {user} = Et();
  const canEdit = ['SUPER_ADMIN','ORDER_OPS'].includes(user?.role);
  const base = '/admin/daily-greetings';
  const list = Le({queryKey:['daily-greeting-publications'],queryFn:()=>le(base),retry:false});
  const rows = list.data?.data ?? [];
  const [date,setDate] = f.useState(() => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
  const [title,setTitle] = f.useState('');
  const [message,setMessage] = f.useState('');
  const [file,setFile] = f.useState(null);
  const [review,setReview] = f.useState(null);
  const [reference,setReference] = f.useState('');
  const [error,setError] = f.useState('');
  const [notice,setNotice] = f.useState('');
  const [busy,setBusy] = f.useState(false);
  const locked = f.useRef(false), fileInput = f.useRef(null);
  const [filter,setFilter] = f.useState('');
  const rowStatus = row => row.status==='DRAFT'?'待審核':row.status==='ARCHIVED'?'已下架':new Date(row.publish_at)>new Date()?'已排程':'已發布';
  const reviewedRow = rows.find(row=>row.id===review?.id);
  f.useEffect(()=>()=>{if(review?.url) URL.revokeObjectURL(review.url);},[review]);
  async function run(work) {
    if(locked.current) return;
    locked.current=true; setBusy(true); setNotice(''); setError('');
    try {await work();} catch(e) {setError(e.message || '操作未完成，請再試一次。');}
    finally {locked.current=false; setBusy(false);}
  }
  async function upload(event) {
    event.preventDefault();
    await run(async()=>{
      if(!file || !date || !title.trim() || !message.trim()) return;
      const bytes=new Uint8Array(await file.arrayBuffer());
      const header=new DataView(bytes.buffer);
      if(bytes.length<33 || header.getUint32(0)!==0x89504e47 || header.getUint32(4)!==0x0d0a1a0a ||
        ![2,6].includes(bytes[25]) || bytes[24]!==8 || bytes[28]!==0)
        throw Error('請選擇一般 8 位元 RGB 或 RGBA PNG 圖片。');
      if([header.getUint32(16),header.getUint32(20)].some(side=>side<256||side>2048))
        throw Error('圖片的寬與高都須介於 256 到 2048 像素。');
      let binary=''; for(const byte of bytes) binary+=String.fromCharCode(byte);
      await $e(base,{date,title:title.trim(),message:message.trim(),contentBase64:btoa(binary)});
      setNotice('草稿已上傳。請在下方預覽加上標誌的完成圖。');
      setFile(null);fileInput.current.value='';setMessage('');setTitle('');setFilter('');
      await list.refetch();
    });
  }
  async function preview(row) {
    await run(async()=>{
      const blob=await Iu(base+'/'+row.id+'/preview');
      setReference('');setReview({id:row.id,url:URL.createObjectURL(blob)});
    });
  }
  async function transition(row,action) {
    await run(async()=>{
      await $e(base+'/'+row.id+'/'+action,action==='publish'?{approvalReference:reference.trim()}:{});
      setNotice(action==='publish'?'已核准發布。':'問候圖已下架。');
      setReview(null);setReference('');await list.refetch();
    });
  }
  const visible = rows.filter(row=>!filter || rowStatus(row)===filter);
  return <div className="greeting-work">
    <PageTitle title="每日問候圖上傳" subtitle="上傳原圖後，預覽含 UCell 標誌的完成圖，再核准發布。"/>
    {canEdit && <Panel title="上傳草稿"><form className="greeting-form" onSubmit={upload}>
      <J label="顯示日期（台北）"><input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></J>
      <J label="問候標題"><input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></J>
      <J label="問候文字"><textarea required maxLength={1000} rows={3} value={message} onChange={e=>setMessage(e.target.value)}/></J>
      <J label="選擇問候原圖" hint="PNG · 600 KB 以下 · 寬高各 256–2048 像素。系統會加上 UCell 標誌。">
        <input ref={fileInput} type="file" accept="image/png" onChange={e=>{
          const next=e.target.files?.[0];setNotice('');setError('');
          if(next?.size>600000){setError('圖片超過 600 KB，請重新選擇。');e.target.value='';setFile(null);}else setFile(next??null);
        }}/>
      </J>
      <button className="primary" disabled={busy || list.isError || !file || !date || !title.trim() || !message.trim()}>上傳草稿</button>
    </form></Panel>}
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
    <Panel title="問候圖紀錄"><div className="greeting-filter">
      <span>核准後於顯示日早上 7 點發布（台北時間）。</span>
      <J label="篩選狀態"><select value={filter} onChange={e=>setFilter(e.target.value)}>
        <option value="">全部狀態</option>{['待審核','已排程','已發布','已下架'].map(s=><option key={s}>{s}</option>)}
      </select></J></div>
      {list.isLoading?<p role="status">載入中…</p>:list.isError?<p role="alert">無法載入紀錄。 <button onClick={()=>list.refetch()}>重試</button></p>:
      <ul className="greeting-records">{visible.map(row=><li key={row.id}>
        <div><strong>{row.title}</strong><small>{String(row.greeting_date).slice(0,10)} · {rowStatus(row)}</small></div>
        <button disabled={busy} onClick={()=>preview(row)}>預覽</button>
        {reviewedRow?.id===row.id&&<div className="greeting-review">
          <img src={review.url} alt={row.title+'，含 UCell 標誌的發布預覽'}/><p>{row.message}</p>
          {canEdit&&row.status!=='PUBLISHED'&&<><J label="核准依據"><input maxLength={200} value={reference} onChange={e=>setReference(e.target.value)}/></J>
          <button type="button" className="primary" disabled={busy||!reference.trim()} onClick={()=>transition(row,'publish')}>{row.status==='ARCHIVED'?'重新核准發布':'核准發布'}</button></>}
          {canEdit&&row.status==='PUBLISHED'&&<button disabled={busy} onClick={()=>transition(row,'archive')}>下架此圖</button>}
          <button disabled={busy} onClick={()=>setReview(null)}>收合預覽</button>
        </div>}
      </li>)}</ul>}
      {!list.isLoading&&!list.isError&&!visible.length&&<p>目前沒有{filter||''}問候圖。</p>}
    </Panel>
  </div>;
}
