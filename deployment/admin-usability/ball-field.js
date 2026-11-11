function UcBallField({effective=false,numberOnly=false,...props}){
 const dialog=f.useRef(null),trigger=f.useRef(null);
 const [open,setOpen]=f.useState(false),[query,setQuery]=f.useState(''),[result,setResult]=f.useState(null);
 f.useEffect(()=>{
   if(!open)return;
   let active=true;const abort=new AbortController();
   const timer=setTimeout(async()=>{
     try{
       const params=new URLSearchParams({take:'20',q:query.trim()});
       if(effective)params.set('status','EFFECTIVE');
       const reply=await Tn('/admin/qualifications?'+params,{signal:abort.signal});
       if(active)setResult({rows:(reply.data??[]).filter(row=>row.ballNo&&(!numberOnly||row.qualificationNo))});
     }catch{if(active)setResult({error:true});}
   },200);
   return ()=>{active=false;abort.abort();clearTimeout(timer);};
 },[open,query,effective,numberOnly]);
 function close(){dialog.current.close();}
 return e.jsxs(e.Fragment,{children:[e.jsx('input',props),e.jsx('button',{ref:trigger,type:'button',className:'ux-pick',disabled:props.disabled,onClick:()=>{setQuery('');setResult(null);setOpen(true);dialog.current.showModal();},children:'從球清單選取'}),
 e.jsx('dialog',{ref:dialog,className:'ux-ball-dialog','aria-label':'選取會員球',onClose:()=>{setOpen(false);trigger.current?.focus();},children:open&&e.jsxs('div',{children:[
 e.jsxs('header',{children:[e.jsx('strong',{children:'選取會員球'}),e.jsx('button',{type:'button',onClick:close,children:'關閉'})]}),
 e.jsx('input',{autoFocus:true,type:'search','aria-label':'依姓名、會員或球號搜尋',placeholder:'搜尋會員姓名或球號',value:query,onChange:event=>{setResult(null);setQuery(event.target.value)},onKeyDown:event=>{if(event.key==='Enter')event.preventDefault();}}),
 e.jsx('div',{role:'status',children:!result?'搜尋中…':result.error?'無法讀取清單，可關閉後直接輸入球號。':!result.rows.length?'沒有符合的球號，請更換搜尋條件。':''}),
 result?.rows?.map(row=>e.jsxs('button',{type:'button',className:'ux-ball-option',onClick:()=>{props.onChange({target:{value:numberOnly?String(row.qualificationNo):row.ballNo}});close();},children:[e.jsx('strong',{children:Ws(row)}),e.jsx('span',{children:row.ballNo})]},row.qualificationId))]})})]});
}
