import {useEffect,useState} from 'react';

export interface SearchOption {id:string;primary:string;secondary?:string;meta?:unknown}
export function SearchSelect({
  label,value,onChange,search,placeholder='輸入姓名、手機、Email或ID'
}:{
  label:string;value?:SearchOption|null;onChange:(x:SearchOption|null)=>void;
  search:(q:string)=>Promise<SearchOption[]>;placeholder?:string;
}){
  const [q,setQ]=useState('');const [options,setOptions]=useState<SearchOption[]>([]);
  const [open,setOpen]=useState(false);const [loading,setLoading]=useState(false);
  useEffect(()=>{
    if(value){setQ(value.primary);return}
  },[value?.id]);
  async function run(v:string){
    setQ(v);onChange(null);
    if(v.trim().length<1){setOptions([]);setOpen(false);return}
    setLoading(true);
    try{setOptions(await search(v));setOpen(true)}finally{setLoading(false)}
  }
  return <label className="field search-select"><span>{label}</span>
    <input value={q} onChange={e=>run(e.target.value)} onFocus={()=>options.length&&setOpen(true)} placeholder={placeholder}/>
    {loading&&<small>搜尋中…</small>}
    {open&&<div className="search-menu">{options.length===0?<div className="search-empty">沒有符合資料</div>:options.map(x=>
      <button type="button" className="search-option" key={x.id} onClick={()=>{onChange(x);setQ(x.primary);setOpen(false)}}>
        <strong>{x.primary}</strong>{x.secondary&&<span>{x.secondary}</span>}
      </button>)}</div>}
  </label>
}
