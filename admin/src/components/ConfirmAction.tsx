import {useState,useRef,type ReactNode} from 'react';
import {ConfirmDialog,UCellButton} from '@ucell/design-system';
import {useAuth} from '../features/auth/auth';
/** Existing handler/authorization remains authoritative; this adds explicit UI confirmation. */
export function ConfirmAction({children,onConfirm,disabled=false,className='',reasonRecorded=false}:{children:ReactNode;onConfirm:(reason:string)=>unknown;disabled?:boolean;className?:string;reasonRecorded?:boolean}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);const flight=useRef(false);const {user}=useAuth();
 return <><UCellButton className={className} disabled={disabled||busy} onClick={()=>setOpen(true)}>{children}</UCellButton><ConfirmDialog open={open} title="確認營運操作" busy={busy||disabled} onCancel={()=>setOpen(false)} onConfirm={async reason=>{if(flight.current||disabled)return;flight.current=true;setBusy(true);try{await onConfirm(reason);setOpen(false)}finally{flight.current=false;setBusy(false)}}}><p>{children}</p><p>目前角色：{user?.role??'未驗證'}；正式 Actor、時間與 Audit 以 Core 紀錄為準。</p>{!reasonRecorded&&<p>此操作仍使用既有送出欄位；確認原因不會自動加入正式 Audit。需要保存的原因請填入原操作表單。</p>}</ConfirmDialog></>;
}
