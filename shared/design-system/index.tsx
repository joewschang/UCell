import {useCallback,useEffect,useRef,useId,type ReactNode,type KeyboardEvent,type ButtonHTMLAttributes} from 'react';
function trapDialogFocus(event:KeyboardEvent<HTMLDialogElement>){if(event.key!=='Tab')return;const items=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(n=>n.getClientRects().length>0&&n.tabIndex>=0);const first=items[0],last=items.at(-1);if(!first){event.preventDefault();event.currentTarget.focus();return}if(event.shiftKey&&(document.activeElement===first||document.activeElement===event.currentTarget)){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}
export type StatusTone='success'|'warning'|'danger'|'info'|'neutral';
const tones:Record<string,StatusTone>={SUCCESS:'success',ACTIVE:'success',EFFECTIVE:'success',PASS:'success',RECOGNIZED:'success',PAID:'success',PENDING:'warning',PROCESSING:'info',PENDING45D:'warning',PENDING_45D:'warning','45D':'warning',SUBMITTED:'warning',SCHEDULED:'warning',DUE:'warning',FAILED:'danger',SUSPENDED:'danger',EXCEPTION:'danger',REVERSED:'danger',CLAWBACK:'danger',DRAFT:'neutral',INACTIVE:'neutral',CANCELLED:'neutral',CLOSED:'neutral',VOIDED:'neutral',EXITED:'neutral',CALCULATED:'info',INFORMATION:'info',PAYABLE:'info'};
export const statusTone=(status:string):StatusTone=>tones[status]??'neutral';
export function StatusBadge({status,label}:{status:string;label?:ReactNode}){return <span className="uc-status" data-tone={statusTone(status)}>{label??status}</span>}
export function UCellButton({variant='secondary',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'}){return <button {...props} type={props.type??'button'} className={`uc-button ${props.className??''}`} data-variant={variant}/>}
export function MetricCard({label,value,helper}:{label:string;value:ReactNode;helper?:string}){return <article className="uc-metric"><span>{label}</span><strong>{value??'待提供'}</strong>{helper&&<small>{helper}</small>}</article>}
// Presentation aliases only; retain raw domain values in evidence and API payloads.
const lifecycleStatus=(status?:string)=>status==='PENDING_45D'||status==='PENDING'?'PENDING45D':status;
export function MoneyState({amount,status}:{amount:number|string|null;status?:string}){return <strong className="uc-money">{amount===null?(status==='PENDING'||status==='CALCULATED'||lifecycleStatus(status)==='PENDING45D'?'結算中':'待提供'):`NT$ ${typeof amount==='number'?amount.toLocaleString('zh-TW'):amount}`}</strong>}
export function PageHeader({title,subtitle,actions}:{title:string;subtitle?:string;actions?:ReactNode}){return <div className="uc-header"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{actions}</div>}
export function SectionHeader({title,children}:{title:string;children?:ReactNode}){return <div className="uc-header"><h2>{title}</h2>{children}</div>}
export function EmptyState({title='尚無資料',children}:{title?:string;children?:ReactNode}){return <section className="uc-state"><h3>{title}</h3>{children}</section>}
export function ErrorState({message,retry}:{message:string;retry?:()=>void}){return <section className="uc-state" role="alert"><p>{message}</p>{retry&&<UCellButton onClick={retry}>重新載入</UCellButton>}</section>}
export function Skeleton(){return <div className="uc-skeleton" aria-hidden="true"/>}
export function LoadingState({label='資料載入中…'}:{label?:string}){return <section className="uc-state" role="status" aria-busy="true"><p>{label}</p><Skeleton/><Skeleton/></section>}
export function QualificationBadge({code,ball,rank}:{code:string;ball?:string;rank?:string}){return <StatusBadge status="INFORMATION" label={[code,rank,ball].filter(Boolean).join('｜')}/>}
export function PeriodBadge({period}:{period:string}){return <StatusBadge status="INFORMATION" label={period}/>}
export function FilterBar({children}:{children:ReactNode}){return <div className="uc-filter">{children}</div>}
function dialogReturnTarget(){if(typeof document==='undefined'||typeof HTMLElement==='undefined')return null;const active=document.activeElement;return active instanceof HTMLElement?active:null}
function restoreDialogFocus(target:HTMLElement|null){if(target?.isConnected)target.focus({preventScroll:true})}
function useModalDialog(open:boolean,dialogRef:{current:HTMLDialogElement|null},onOpened?:()=>void){const returnTarget=useRef<HTMLElement|null>(null);useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;if(open&&!dialog.open){returnTarget.current=dialogReturnTarget();dialog.showModal();onOpened?.();return}if(!open&&dialog.open){dialog.close();const target=returnTarget.current;returnTarget.current=null;restoreDialogFocus(target)}},[open,onOpened])}
export function DetailDrawer({open,title,onClose,children}:{open:boolean;title:string;onClose:()=>void;children:ReactNode}){const ref=useRef<HTMLDialogElement>(null);const id=useId();useModalDialog(open,ref);return <dialog ref={ref} onKeyDown={trapDialogFocus} className="uc-dialog uc-drawer" aria-labelledby={id} onCancel={e=>{e.preventDefault();onClose()}}><h2 id={id}>{title}</h2><UCellButton onClick={onClose}>關閉</UCellButton>{children}</dialog>}
export function ConfirmDialog({open,title,onCancel,onConfirm,children,busy=false}:{open:boolean;title:string;onCancel:()=>void;onConfirm:(reason:string)=>void;children?:ReactNode;busy?:boolean}){const ref=useRef<HTMLDialogElement>(null);const reason=useRef<HTMLInputElement>(null);const id=useId();const clearReason=useCallback(()=>{if(reason.current)reason.current.value=''},[]);useModalDialog(open,ref,clearReason);return <dialog ref={ref} onKeyDown={trapDialogFocus} className="uc-dialog" aria-labelledby={id} onCancel={e=>{e.preventDefault();if(!busy)onCancel()}}><h2 id={id}>{title}</h2>{children}<form onSubmit={e=>{e.preventDefault();if(!busy&&reason.current?.value.trim())onConfirm(reason.current.value.trim())}}><label>操作原因<input ref={reason} required disabled={busy}/></label><UCellButton disabled={busy} onClick={onCancel}>取消</UCellButton><UCellButton type="submit" variant="primary" disabled={busy}>確認</UCellButton></form></dialog>}
const lifecycleStages=[['CALCULATED','已計算'],['PENDING45D','等待生效'],['EFFECTIVE','已生效'],['PAYABLE','可支付'],['PAID','已支付']] as const;
export function AwardLifecycle({status}:{status:string}){return <><ol className="uc-award-timeline" aria-label="獎金生命週期">{lifecycleStages.map(([code,label])=><li key={code} aria-current={code===lifecycleStatus(status)?'step':undefined}><span className="uc-timeline-node" aria-hidden="true"/><span>{label}</span>{code===lifecycleStatus(status)&&<small>目前狀態</small>}</li>)}</ol><small className="uc-muted">僅標示目前狀態；其他階段不代表已完成。</small></>}

export function MemberAppShell({children}:{children:ReactNode}){return <div className="app" data-app="member">{children}</div>}
export function MemberBottomNav({children}:{children:ReactNode}){return <nav aria-label="主要功能">{children}</nav>}
export function QualificationSwitcher({options,value,onChange,feedback,active}:{options:{id:string;label:string}[];value:string;onChange:(id:string)=>void;feedback:string;active:boolean}){return <section className="uc-section uc-context"><label htmlFor="qualification">目前資格</label><select id="qualification" value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select><small>{active?'資格活躍':'資格未活躍'} · 以下組織、業績與獎金均屬此資格</small><p role="status" aria-live="polite">{feedback}</p></section>}
export const MobileMetricCard=MetricCard;
export function MobileActionGrid({children}:{children:ReactNode}){return <section className="uc-actions">{children}</section>}
export function MemberSection({title,children}:{title?:string;children:ReactNode}){return <section className="uc-member-section">{title&&<h3>{title}</h3>}{children}</section>}
export function MemberStatusCard({title,status,label,children}:{title:string;status:string;label?:string;children?:ReactNode}){return <section className="uc-section"><h3>{title}</h3><StatusBadge status={status} label={label}/>{children}</section>}
export function AdminAppShell({children}:{children:ReactNode}){return <div className="app" data-app="admin">{children}</div>}
export function AdminSidebar({children}:{children:ReactNode}){return <aside className="sidebar">{children}</aside>}
export function AdminHeader({children}:{children:ReactNode}){return <div className="uc-console-header">{children}</div>}
export const AdminPageHeader=PageHeader;
export const AdminFilterBar=FilterBar;
export const AdminMetricCard=MetricCard;
export const AdminDetailDrawer=DetailDrawer;
export function AdminCommandBar({children}:{children:ReactNode}){return <div className="button-row" role="group" aria-label="營運操作">{children}</div>}
export function AdminAlertPanel({title,children}:{title:string;children:ReactNode}){return <section className="uc-state" aria-label={title}><h2>{title}</h2>{children}</section>}

export * from './icons';
