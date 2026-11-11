export function holderView(React, jsx, api, scope) {
  return function SponsorName({code}) {
    const value=String(code || '').trim().toUpperCase();
    const [result,setResult]=React.useState(null);
    React.useEffect(()=>{
      if(!sessionStorage.getItem('ucell_'+scope+'_token') || !/^[A-Z0-9_-]{2,48}$/.test(value)) return;
      const abort=new AbortController();
      const wait=setTimeout(async()=>{
        try {
          const response=await api('/'+scope+'/sponsor-holder/'+encodeURIComponent(value),{signal:abort.signal});
          if(!abort.signal.aborted)setResult({value,name:(response.data??response).name});
        }catch{if(!abort.signal.aborted)setResult({value,name:null});}
      },300);
      return ()=>{abort.abort();clearTimeout(wait);};
    },[value]);
    if(!value || result?.value!==value)return null;
    return jsx('small',{role:'status',children:result.name?' · 推薦人：'+result.name:' · 推薦人姓名未能核對'});
  };
}

export function addressViews(React, jsx, api, currentDocuments) {
  function AddressHint({address,current,apply}){
    if(!address)return null;
    const normalize=s=>String(s??'').normalize('NFKC').replace(/\s/g,'').replace(/臺/g,'台');
    const matches=normalize(address)===normalize(current);
    return jsx('div',{className:'callout info',children:[
      jsx('strong',{children:'證件背面戶籍地址'}),jsx('p',{children:address}),
      jsx('p',{children:matches?'與通訊地址一致。':current?'與通訊地址不同，請確認實際收件地址。':'通訊地址尚未填寫。'}),
      apply&&!matches&&jsx('button',{type:'button',onClick:()=>apply(address),children:'將戶籍地址帶入通訊地址'})
    ]});
  }
    async function upload(file){
      if(file.size>12*1024*1024 || !['image/jpeg','image/png'].includes(file.type))throw Error('Invalid image');
      const content=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(file);});
      const response=await api('/admin/paper-order-workbench/read-address',{method:'POST',timeoutMs:90000,body:JSON.stringify({content,mime:file.type})});
      return (response.data??response).address;
    }

  function ManualCheck({file,current,apply,disabled}){
    const [state,setState]=React.useState(null);
    const active=React.useRef(file);
    active.current=file;
    if(!file)return null;
    const visible=state?.file===file?state:null;
    async function read(){
      setState({file,busy:true});
      try{
        const address=await upload(file);
        if(active.current===file)setState({file,address,notice:address?'':'未能辨識完整戶籍地址，請核對原圖。'});
      }catch{if(active.current===file)setState({file,notice:'辨識失敗，可重試或手動填寫。'});}
    }
    return jsx('div',{children:[jsx('button',{type:'button',disabled:disabled||visible?.busy,onClick:read,children:visible?.busy?'辨識中…':'辨識已選的身分證背面'}),jsx('span',{role:'status',children:visible?.notice}),jsx(AddressHint,{current,address:visible?.address,apply:disabled?undefined:apply})]});
  }
  function PaperCheck({row}){
    const [saved,setSaved]=React.useState(''),[address,setAddress]=React.useState(''),[notice,setNotice]=React.useState(''),[busy,setBusy]=React.useState(false);
    async function read(action){
      setAddress('');setNotice('');setBusy(true);
      try{const value=await action();setAddress(value);if(!value)setNotice('未能辨識完整戶籍地址，請核對原圖。');}
      catch{setNotice('無法讀取資料，請確認文件與權限後重試。');}finally{setBusy(false);}
    }
    async function existing(){
      const root='/admin/formal-member-applications/'+row.sourceId;
      const [detail,docs]=await Promise.all([api(root+'/detail'),api(root+'/documents')]);
      setSaved((detail.data??detail).payload?.communicationAddress || '');
      const list=currentDocuments(docs.data??docs);
      const type=(detail.data??detail).applicantType==='LEGAL_ENTITY'?'REPRESENTATIVE_IDENTITY_BACK':'IDENTITY_BACK';
      const doc=list.find(d=>d.type===type)??list.find(d=>d.type==='IDENTITY_BACK');
      if(!doc){throw Error('Missing document');}
      const response=await api('/admin/formal-member-applications/documents/'+doc.id+'/recognize',{method:'POST',timeoutMs:90000});
      return (response.data??response).registeredAddress;
    }
    return jsx('details',{children:[jsx('summary',{children:'核對身分證背面地址'}),jsx('fieldset',{disabled:busy,children:[
      row.source==='FORMAL'&&jsx('button',{type:'button',onClick:()=>read(existing),children:'辨識已存的證件背面'}),
      jsx('label',{children:['或選擇證件背面圖片',jsx('input',{type:'file',accept:'image/jpeg,image/png',onChange:e=>{const file=e.target.files?.[0];e.target.value='';if(file)read(()=>upload(file));}})]}),
      jsx('label',{children:['供比對的通訊地址',jsx('input',{value:saved,onChange:e=>setSaved(e.target.value)})]}),
      jsx('small',{children:'僅供本次建單核對。需更正申請資料時，請至會員申請審核儲存。'}),
      jsx('p',{role:'status',children:busy?'正在辨識…':notice}),jsx(AddressHint,{address,current:saved})
    ]})]});
  }
  return {AddressHint,PaperCheck,ManualCheck};
}
