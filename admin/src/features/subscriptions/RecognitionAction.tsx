import {useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {ConfirmAction} from '../../components/ConfirmAction';
import {ErrorBox} from '../../components/ui';
import {useAuth} from '../auth/auth';
import {command} from '../../lib/api';

export function RecognitionAction({schedule,subscriptionId,loading}:{schedule:{recognitionId:string;status:string;dueAt:string;workerBlocked?:boolean;workerFailureCount?:number;workerNextAttemptAt?:string|null;workerLastErrorCode?:string|null;workerLastTraceId?:string|null};subscriptionId:string;loading:boolean}){
 const {user}=useAuth(),qc=useQueryClient(),flight=useRef(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null),[notice,setNotice]=useState(''),[submitted,setSubmitted]=useState(false);
 const allowed=['SUPER_ADMIN','FINANCE'].includes(user?.role??'');
 const eligible=['SCHEDULED','DUE'].includes(schedule.status)&&Number.isFinite(Date.parse(schedule.dueAt))&&Date.parse(schedule.dueAt)<=Date.now();
 async function refresh(){
  await qc.invalidateQueries({queryKey:['subscription',subscriptionId]}, {throwOnError:true});
  await qc.invalidateQueries({queryKey:['subscriptions']}, {throwOnError:true});
 }
 async function run(){
  if(flight.current||!allowed||!eligible||loading||submitted)return;
  flight.current=true;setBusy(true);setError(null);setNotice('');setSubmitted(true);
  try{
   const response=await command<{data:{skipped?:string}}>(`/admin/rpv/recognitions/${encodeURIComponent(schedule.recognitionId)}/run`);
   setNotice(response.data?.skipped?'本次未執行認列，請核對重新載入的狀態。':'認列已完成。');
  }catch(e){setError(e);setNotice('尚未確認完成，請先重新查核狀態。若仍待認列，請核對錯誤原因後再試；請勿另建排程。');}
  finally{
   try{await refresh();}catch{setNotice(v=>v+' 狀態更新失敗，請重新查核。');}
   flight.current=false;setBusy(false);
  }
 }
 const recovery=!!schedule.workerFailureCount&&<p>Worker 累計失敗 {schedule.workerFailureCount} 次；{schedule.workerBlocked?'已暫停自動處理，請修正原因後手動認列。':schedule.workerNextAttemptAt?`下次自動嘗試：${schedule.workerNextAttemptAt}`:'目前無待重試時間。'}<br/>最後錯誤：{schedule.workerLastErrorCode}；追蹤碼：{schedule.workerLastTraceId}</p>;
 if(!allowed)return <>{recovery}<span>僅供查閱</span></>;
 return <>{recovery}<ConfirmAction disabled={busy||loading||!eligible||submitted} onConfirm={run}>執行／重試認列</ConfirmAction>
 <ErrorBox error={error}/>{notice&&<p role="status">{notice}</p>}
 {submitted&&<button disabled={busy||loading} onClick={async()=>{if(flight.current)return;flight.current=true;setBusy(true);try{await refresh();setSubmitted(false);setError(null);setNotice('已重新查核，請依最新狀態與錯誤原因判斷是否重試。');}catch{setNotice('狀態更新失敗，尚不能重試。');}finally{flight.current=false;setBusy(false);}}}>重新查核狀態</button>}</>;
}
