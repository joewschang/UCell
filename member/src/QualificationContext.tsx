import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {getQualifications} from './memberData';
import type {Qualification} from './api';

type State={qualifications:Qualification[];current:Qualification|null;select:(id:string)=>void;loading:boolean};
const C=createContext<State|null>(null);
export function QualificationProvider({children}:{children:React.ReactNode}){
 const [items,setItems]=useState<Qualification[]>([]); const [id,setId]=useState(''); const [loading,setLoading]=useState(true);
 useEffect(()=>{getQualifications().then(q=>{setItems(q);setId(sessionStorage.getItem('ucell_qualification_id')||q[0]?.id||'')}).finally(()=>setLoading(false))},[]);
 const select=(next:string)=>{setId(next);sessionStorage.setItem('ucell_qualification_id',next)};
 const value=useMemo(()=>({qualifications:items,current:items.find(x=>x.id===id)||items[0]||null,select,loading}),[items,id,loading]);
 return <C.Provider value={value}>{children}</C.Provider>;
}
export function useQualification(){const v=useContext(C);if(!v)throw new Error('QualificationProvider missing');return v}
