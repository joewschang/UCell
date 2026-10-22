import {uiValue,uiText} from "../../../shared/design-system/i18n";
import {useEffect,useRef,useState} from 'react';

export interface SearchOption {id:string;primary:string;secondary?:string;meta?:unknown}
export function SearchSelect({
  label,value,onChange,search,placeholder=uiText("輸入姓名、手機、Email或ID")
}:{
  label:string;value?:SearchOption|null;onChange:(x:SearchOption|null)=>void;
  search:(q:string)=>Promise<SearchOption[]>;placeholder?:string;
}){
  const [q,setQ]=useState('');const [options,setOptions]=useState<SearchOption[]>([]);
  const [open,setOpen]=useState(false);const [loading,setLoading]=useState(false);
  const serial=useRef(0);const [error,setError]=useState('');
  useEffect(()=>()=>{serial.current++},[]);
  useEffect(()=>{
    if(value){setQ(value.primary);return}
  },[value?.id]);
  async function run(v:string){
    const ticket=++serial.current;setQ(v);onChange(null);setError('');setOptions([]);setOpen(false);
    if(v.trim().length<1){setOptions([]);setOpen(false);setLoading(false);return}
    setLoading(true);
    try{const result=await search(v);if(ticket===serial.current){setOptions(result);setOpen(true)}}catch{if(ticket===serial.current)setError('搜尋失敗，請重新輸入球號或搜尋條件後重試。')}finally{if(ticket===serial.current)setLoading(false)}
  }
  return <label className="field search-select"><span>{uiValue((label))}</span>
    <input value={q} onChange={e=>run(e.target.value)} onFocus={()=>options.length&&setOpen(true)} placeholder={placeholder}/>
    {loading&&<small>搜尋中…</small>}
    {error&&<small role="alert">{error}</small>}
    {open&&<div className="search-menu">{options.length===0?<div className="search-empty">沒有符合資料</div>:options.map(x=>
      <button type="button" className="search-option" key={x.id} onClick={()=>{serial.current++;setLoading(false);onChange(x);setQ(x.primary);setOpen(false)}}>
        <strong>{x.primary}</strong>{x.secondary&&<span>{x.secondary}</span>}
      </button>)}</div>}
  </label>
}
