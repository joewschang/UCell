import {useMemo,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {AdminTable} from '../../components/AdminTable';
import {Badge,Card,ErrorBox,Field,PageHeader} from '../../components/ui';
import {command,get} from '../../lib/api';
import {useAuth} from '../auth/auth';

type Version={id:string;version:number;title:string;summary:string|null;url:string;thumbnailUrl:string|null;audiencePolicy:'NETWORK_MEMBER';shareable:boolean;publishFrom:string|null;publishTo:string|null;status:'DRAFT'|'PUBLISHED'|'ARCHIVED';approvalReference:string|null;approvedAt:string|null;contentHash:string};
type Content={id:string;type:'VIDEO_EXTERNAL'|'EXTERNAL_LINK';status:string;createdAt:string;versions:Version[]};
const initial={contentType:'VIDEO_EXTERNAL' as const,title:'',summary:'',externalUrl:'',thumbnailUrl:'',audiencePolicy:'NETWORK_MEMBER' as const,shareable:true,publishFrom:'',publishTo:''};
const iso=(value:string)=>value?new Date(value).toISOString():undefined;

export function ContentPage(){
 const {user}=useAuth(),editable=user?.role==='SUPER_ADMIN'||user?.role==='ORDER_OPS',qc=useQueryClient();
 const query=useQuery({queryKey:['content'],queryFn:()=>get<any>('/admin/content')});
 const rows:Content[]=query.error?[]:query.data?.data??[];
 const [form,setForm]=useState(initial),[target,setTarget]=useState(''),[approval,setApproval]=useState(''),[error,setError]=useState<unknown>(null);
 const selected=useMemo(()=>rows.find(row=>row.id===target),[rows,target]);
 const payload=()=>({...form,summary:form.summary||undefined,thumbnailUrl:form.thumbnailUrl||undefined,publishFrom:iso(form.publishFrom),publishTo:iso(form.publishTo)});
 const refresh=()=>qc.invalidateQueries({queryKey:['content']});
 const create=useMutation({mutationFn:()=>command('/admin/content',payload()),onSuccess:()=>{setForm(initial);refresh()},onError:setError});
 const version=useMutation({mutationFn:()=>command(`/admin/content/${encodeURIComponent(target)}/versions`,{...payload(),contentType:selected?.type??form.contentType}),onSuccess:()=>{setForm(initial);refresh()},onError:setError});
 const publish=useMutation({mutationFn:(input:{contentId:string;versionId:string})=>command(`/admin/content/${encodeURIComponent(input.contentId)}/versions/${encodeURIComponent(input.versionId)}/publish`,{approvalReference:approval}),onSuccess:()=>{setApproval('');refresh()},onError:setError});
 return <><PageHeader title="影音／連結內容" subtitle="外部 HTTPS 內容採版本化審核發布；已發布版本不可覆寫。"/>
  <div className="callout info"><strong>目前儲存邊界：</strong>只接受 HTTPS 外部影音或連結。二進位上傳仍等待物件儲存、掃毒與存取政策核准。</div>
  <ErrorBox error={error??query.error}/>
  {editable&&<div className="grid two"><Card title="建立內容或新版本"><div className="form">
   <Field label="操作"><select value={target} onChange={e=>setTarget(e.target.value)}><option value="">建立新內容</option>{rows.map(row=><option key={row.id} value={row.id}>新增版本：{row.versions[0]?.title??row.id}</option>)}</select></Field>
   <Field label="類型"><select disabled={!!selected} value={selected?.type??form.contentType} onChange={e=>setForm(v=>({...v,contentType:e.target.value as typeof v.contentType}))}><option value="VIDEO_EXTERNAL">外部影音</option><option value="EXTERNAL_LINK">外部連結</option></select></Field>
   <Field label="標題"><input maxLength={160} value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))}/></Field>
   <Field label="摘要"><textarea maxLength={1000} value={form.summary} onChange={e=>setForm(v=>({...v,summary:e.target.value}))}/></Field>
   <Field label="HTTPS 內容 URL"><input type="url" value={form.externalUrl} onChange={e=>setForm(v=>({...v,externalUrl:e.target.value}))}/></Field>
   <Field label="HTTPS 縮圖 URL（選填）"><input type="url" value={form.thumbnailUrl} onChange={e=>setForm(v=>({...v,thumbnailUrl:e.target.value}))}/></Field>
   <Field label="開始顯示（選填）"><input type="datetime-local" value={form.publishFrom} onChange={e=>setForm(v=>({...v,publishFrom:e.target.value}))}/></Field>
   <Field label="停止顯示（選填）"><input type="datetime-local" value={form.publishTo} onChange={e=>setForm(v=>({...v,publishTo:e.target.value}))}/></Field>
   <label><input type="checkbox" checked={form.shareable} onChange={e=>setForm(v=>({...v,shareable:e.target.checked}))}/> 允許會員分享</label>
   <button className="primary" disabled={!form.title.trim()||!form.externalUrl.startsWith('https://')||create.isPending||version.isPending} onClick={()=>target?version.mutate():create.mutate()}>{target?'建立不可變新版本':'建立草稿'}</button>
  </div></Card><Card title="發布核准"><p>發布按鈕只會作用於下方所選草稿。核准參照會寫入不可變版本證據。</p><Field label="Approval Reference"><input value={approval} onChange={e=>setApproval(e.target.value)} placeholder="核准單號／正式依據"/></Field></Card></div>}
  <Card title="內容與版本"><div className="table-wrap"><AdminTable><thead><tr><th>內容</th><th>版本</th><th>類型</th><th>狀態</th><th>顯示期間</th><th>核准／操作</th></tr></thead><tbody>{rows.flatMap(content=>content.versions.map(versionRow=><tr key={versionRow.id}><td><strong>{versionRow.title}</strong><br/><a href={versionRow.url} target="_blank" rel="noreferrer">檢視外部內容</a><br/><small className="mono">{content.id}</small></td><td>v{versionRow.version}</td><td>{content.type}</td><td><Badge tone={versionRow.status==='PUBLISHED'?'ok':versionRow.status==='DRAFT'?'warn':'neutral'}>{versionRow.status}</Badge></td><td>{versionRow.publishFrom??'立即'}<br/>{versionRow.publishTo?`至 ${versionRow.publishTo}`:'無截止'}</td><td>{versionRow.approvalReference??'尚未核准'}{editable&&versionRow.status==='DRAFT'&&<><br/><button disabled={!approval.trim()||publish.isPending} onClick={()=>publish.mutate({contentId:content.id,versionId:versionRow.id})}>核准發布</button></>}</td></tr>))}</tbody></AdminTable></div>{!rows.length&&!query.isLoading&&<p>尚無內容。</p>}</Card>
 </>;
}