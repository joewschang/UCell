import {useEffect,useRef,useState} from 'react';
import {useResource} from '../useResource';
import {assignRootSponsor,bundleError,getSponsorCandidate} from './api';

export function useSponsor(applicationId:string,code:string) {
  const [debounced,setDebounced]=useState(code);
  useEffect(()=>{const timer=setTimeout(()=>setDebounced(code),350);return ()=>clearTimeout(timer);},[code]);
  const valid=/^(?:[0-9]{10}-[0-9]{2,19}|[A-Z][A-Z0-9_-]{1,39})$/.test(code);
  return useResource('enrollment-bundle-sponsor:'+applicationId+':'+code,signal=>getSponsorCandidate(applicationId,code,signal),valid&&code===debounced);
}
export function sponsorDescription(candidate:NonNullable<ReturnType<typeof useSponsor>['data']>){
  return candidate.ballNo+' · '+candidate.name;
}
export default function RootSponsor({applicationId,onSaved,afterCollection=false}:{applicationId:string;onSaved:()=>void;afterCollection?:boolean}){
  const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const candidate=useSponsor(applicationId,code),last=useRef({code:'',key:''}),lock=useRef(false);
  async function save(){
    if(lock.current||!candidate.data)return;
    lock.current=true;setBusy(true);setError('');
    if(last.current.code!==code)last.current={code,key:crypto.randomUUID()};
    try{await assignRootSponsor(applicationId,candidate.data.ballNo,last.current.key);onSaved();}
    catch(e){setError(bundleError(e));onSaved();}finally{lock.current=false;setBusy(false);}
  }
  return <section className="eb-origin"><div>
    <label className="eb-label">第 1 球推薦球號<input value={code} maxLength={40} autoCapitalize="characters" onChange={e=>setCode(e.target.value.trim().toUpperCase())}/></label>
    {candidate.data&&<p role="status">推薦球已核對　{sponsorDescription(candidate.data)}</p>}
    {candidate.error&&<p role="alert">{candidate.error}</p>}{error&&<p role="alert">{error}</p>}
    <p>{afterCollection?'整組款項已核對。請補填第 1 球的組外推薦球，讓承辦人員接續安置。':'請核對第 1 球的組外推薦球。'}設定後如需更正，請洽承辦人。</p>
    <button type="button" disabled={!candidate.data||busy} onClick={save}>確認第 1 球推薦人</button>
  </div></section>;
}
