import {useRef,useState} from 'react';
import {ConfirmAction} from '../../components/ConfirmAction';
import {ApiError,command,get} from '../../lib/api';
import {documentLabels} from './reviewDocuments';

export function approvalErrorMessage(error:unknown){
 const body=error instanceof ApiError?error.body as any:null;
 const messages:Record<string,string>={
  FORMAL_ENROLLMENT_PAYMENT_REQUIRED:'資格套組或正式會員費尚未確認付款，請先確認付款狀態。',
  FORMAL_APPLICATION_NOT_APPROVABLE:'申請目前不是審查中，請重新查詢最新狀態。',
  FORMAL_IDENTITY_ALREADY_OWNED:'此身分資料已登記於另一會員，請先完成重複身分審查。',
  FORMAL_IDENTITY_FINGERPRINT_REQUIRED:'身分資料尚未完整建立，請先核對並儲存申請資料。',
  FORMAL_APPROVAL_GATE_BLOCKED:'尚有必要審查未完成，請確認配偶、跨線審查及文件資料。',
  SPOUSE_VERIFICATION_REQUIRED:'請先完成配偶資料核驗。',
  CROSS_LINE_REVIEW_CLEAR_REQUIRED:'請先完成跨線審查並排除衝突。',
  RETRYABLE_CONFLICT:'資料正由其他操作更新，請重新查詢狀態後再試。',
 };
 for(const [type,label] of Object.entries(documentLabels)){
  messages[type+'_MISSING']=`尚缺${label}。`;
  messages[type+'_REVIEW_REQUIRED']=`請先確認已核對${label}。`;
 }
 const details=Array.isArray(body?.details?.codes)?body.details.codes:[];
 const known=details.filter((code:unknown)=>typeof code==='string'&&messages[code]).map((code:string)=>messages[code]);
 return [...new Set(known)].join(' ')||messages[body?.code]||(error instanceof Error?error.message:'服務暫時無法完成核准，請稍後重試。');
}

export function FormalApprovalAction({applicationId,status,disabled,onBusy,onApproved}:{applicationId:string;status:string;disabled:boolean;onBusy:(busy:boolean)=>void;onApproved:()=>void}){
 const [phase,setPhase]=useState<'idle'|'pending'|'approved'|'failed'|'unknown'|'checking'>('idle'),[message,setMessage]=useState('');
 const flight=useRef(false);
 const approved=status==='APPROVED'||phase==='approved';
 const pending=phase==='pending'||phase==='checking';
 function success(){setPhase('approved');setMessage('核准成功，申請人已成為正式會員。');onApproved();}
 async function approve(){
  if(flight.current||disabled||approved)return;flight.current=true;onBusy(true);setPhase('pending');setMessage('正在核准正式會員，請稍候，勿重複操作。');
  try{
   const result=await command<any>(`/admin/formal-member-applications/${applicationId}/approve`);
   if(result?.data?.status==='APPROVED')success();
   else{setPhase('unknown');setMessage('系統尚未確認核准結果，請按「查詢核准結果」。');}
  }catch(error){
   const uncertain=!(error instanceof ApiError)||error.status===0||error.status>=500;
   setPhase(uncertain?'unknown':'failed');setMessage(uncertain?'未能確認核准結果，可能是連線中斷或服務暫時異常。請先查詢結果，避免重複核准。':'核准失敗：'+approvalErrorMessage(error));
  }finally{flight.current=false;onBusy(false);}
 }
 async function check(){
  if(flight.current)return;flight.current=true;onBusy(true);setPhase('checking');setMessage('正在查詢最新核准結果…');
  try{
   const result=await get<any>(`/admin/formal-member-applications/${applicationId}/detail`);
   if(result?.data?.status==='APPROVED')success();
   else if(result?.data?.status==='UNDER_REVIEW'){setPhase('failed');setMessage('已查詢：目前仍為審查中，尚未核准完成。請確認資料後再試。');}
   else{setPhase('unknown');setMessage('目前申請狀態已變更，請重新整理審查詳情後確認。');}
  }catch(error){setPhase('unknown');setMessage('查詢結果失敗：'+approvalErrorMessage(error));}
  finally{flight.current=false;onBusy(false);}
 }
 return <div className="formal-approval-feedback" aria-busy={pending}>
  {approved?<button className="primary" disabled>已核准正式會員</button>:phase==='unknown'||phase==='checking'?<button type="button" disabled={disabled||pending} onClick={()=>void check()}>{pending?'正在查詢核准結果…':'查詢核准結果'}</button>:<ConfirmAction className="primary" disabled={disabled||pending} onConfirm={approve}>{pending?'核准中，請稍候…':phase==='failed'?'重新核准正式會員':'核准正式會員'}</ConfirmAction>}
  {(message||approved)&&<p role={!approved&&(phase==='failed'||phase==='unknown')?'alert':'status'} aria-live="polite">{approved?'核准成功，申請人已成為正式會員。':message}</p>}
 </div>;
}
