import {PublishContentAction} from './PublishContentAction';
import {RecommendationFlow} from '../../components/RecommendationFlow';
import {uiValue,uiText,domainLabel} from "../../../../shared/design-system/i18n";
import {useMemo,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {AdminTable} from '../../components/AdminTable';
import {Badge,Card,ErrorBox,Field,PageHeader} from '../../components/ui';
import {command,get} from '../../lib/api';
import {useAuth} from '../auth/auth';

type Version={id:string;version:number;title:string;summary:string|null;url:string;thumbnailUrl:string|null;audiencePolicy:'NETWORK_MEMBER'|'PUBLIC';shareable:boolean;publishFrom:string|null;publishTo:string|null;status:'DRAFT'|'PUBLISHED'|'ARCHIVED';approvalReference:string|null;approvedAt:string|null;contentHash:string};
type Content={id:string;type:'VIDEO_EXTERNAL'|'EXTERNAL_LINK';status:string;createdAt:string;versions:Version[]};
const initial={contentType:'VIDEO_EXTERNAL' as const,title:'',summary:'',externalUrl:'',thumbnailUrl:'',audiencePolicy:'NETWORK_MEMBER' as 'NETWORK_MEMBER'|'PUBLIC',shareable:true,publishFrom:'',publishTo:''};
const localDate=(value:string|null)=>{if(!value)return '';const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const iso=(value:string)=>value?new Date(value).toISOString():undefined;

export function ContentPage(){
 const {user}=useAuth(),editable=user?.role==='SUPER_ADMIN'||user?.role==='ORDER_OPS',qc=useQueryClient();
 const query=useQuery({queryKey:['content'],queryFn:()=>get<any>('/admin/content')});
 const insights=useQuery({queryKey:['content-insights'],queryFn:()=>get<any>('/admin/content-insights')});
 const archive=useMutation({mutationFn:(id:string)=>command('/admin/content/'+id+'/archive',{}),onSuccess:()=>qc.invalidateQueries({queryKey:['content']}),onError:(e)=>setError(e)});
 const [archiveTarget,setArchiveTarget]=useState('');
 const rows:Content[]=query.error?[]:query.data?.data??[];
 const [form,setForm]=useState(initial),[target,setTarget]=useState(''),[error,setError]=useState<unknown>(null);
 const selected=useMemo(()=>rows.find(row=>row.id===target),[rows,target]);
 const payload=()=>({...form,summary:form.summary||undefined,thumbnailUrl:form.thumbnailUrl||undefined,publishFrom:iso(form.publishFrom),publishTo:iso(form.publishTo)});
 const refresh=()=>qc.invalidateQueries({queryKey:['content']});
 const create=useMutation({mutationFn:()=>command('/admin/content',payload()),onSuccess:()=>{setForm(initial);refresh()},onError:setError});
 const version=useMutation({mutationFn:()=>command(`/admin/content/${encodeURIComponent(target)}/versions`,{...payload(),contentType:selected?.type??form.contentType}),onSuccess:()=>{setForm(initial);refresh()},onError:setError});
 return <><PageHeader title="影音／連結內容" subtitle={uiText("外部 HTTPS 內容採版本化審核發布；已發布版本不可覆寫。")}/><RecommendationFlow kind="CONTENT"/>
  <div className="callout info"><strong>目前儲存邊界：</strong>{uiText("只接受 HTTPS 外部影音或連結。請提供影片或素材網址及封面，先建立草稿再核准發布。")}</div>
  <ErrorBox error={error??query.error??insights.error}/>
  <Card title="分享成效"><p>近 30 天建立的連結累積成效；有效造訪不是觀看完成，已連結會員包含原會員登入。不同內容的人數不可直接相加。</p>{insights.isLoading?<p>正在載入…</p>:<div className="table-wrap"><AdminTable><thead><tr><th>內容</th><th>連結</th><th>有效造訪</th><th>已連結會員</th><th>新註冊會員</th></tr></thead><tbody>{(insights.data?.data?.rows??[]).map((r:any)=><tr key={(r.targetType??'CONTENT')+':'+(r.targetReference??r.contentId??'invite')}><td><small>{{PRODUCT:'商品',EVENT:'活動',CONTENT:'影音',INVITE:'會員邀請'}[r.targetType as string]??'分享'}</small><br/>{r.title??'一般邀請'}</td><td>{r.links}</td><td>{r.visitors}</td><td>{r.boundMembers}</td><td>{r.registrations}</td></tr>)}</tbody></AdminTable>{!insights.data?.data?.rows?.length&&<p>目前沒有分享成效紀錄。</p>}</div>}<button onClick={()=>insights.refetch()}>更新成效</button></Card>
  {editable&&<div className="grid two"><Card title="建立內容或新版本"><div className="form">
   <Field label="操作"><select value={target} onChange={e=>{setTarget(e.target.value);const c=rows.find(r=>r.id===e.target.value),v=c?.versions[0];if(v&&c)setForm({...initial,contentType:c.type as typeof initial.contentType,title:v.title,summary:v.summary??'',externalUrl:v.url,thumbnailUrl:v.thumbnailUrl??'',audiencePolicy:v.audiencePolicy,shareable:v.shareable,publishFrom:localDate(v.publishFrom),publishTo:localDate(v.publishTo)});else setForm(initial)}}><option value="">建立新內容</option>{rows.map(row=><option key={row.id} value={row.id}>新增版本：{uiValue((row.versions[0]?.title??row.id))}</option>)}</select></Field>
   <Field label="類型"><select disabled={!!selected} value={selected?.type??form.contentType} onChange={e=>setForm(v=>({...v,contentType:e.target.value as typeof v.contentType}))}><option value="VIDEO_EXTERNAL">外部影音</option><option value="EXTERNAL_LINK">外部連結</option></select></Field>
   <Field label="標題"><input maxLength={160} value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))}/></Field>
   <Field label="摘要"><textarea maxLength={1000} value={form.summary} onChange={e=>setForm(v=>({...v,summary:e.target.value}))}/></Field>
   <Field label={uiText("HTTPS 內容 URL")}><input type="url" value={form.externalUrl} onChange={e=>setForm(v=>({...v,externalUrl:e.target.value}))}/></Field>
   <Field label={uiText("HTTPS 縮圖 URL（選填）")}><input type="url" value={form.thumbnailUrl} onChange={e=>setForm(v=>({...v,thumbnailUrl:e.target.value}))}/></Field>
   <Field label="發布範圍"><select value={form.audiencePolicy} onChange={e=>setForm(v=>({...v,audiencePolicy:e.target.value as typeof v.audiencePolicy}))}><option value="NETWORK_MEMBER">會員專用</option><option value="PUBLIC">官網公開（所有訪客可見）</option></select></Field>{form.audiencePolicy==='PUBLIC'&&<p role="note">核准發布後將出現在官網影片與素材專區。請確認內容及外部連結可公開瀏覽，且不含會員個資或內部資訊。</p>}<Field label="開始顯示（選填）"><input type="datetime-local" value={form.publishFrom} onChange={e=>setForm(v=>({...v,publishFrom:e.target.value}))}/></Field>
   <Field label="停止顯示（選填）"><input type="datetime-local" value={form.publishTo} onChange={e=>setForm(v=>({...v,publishTo:e.target.value}))}/></Field>
   <label><input type="checkbox" checked={form.shareable} onChange={e=>setForm(v=>({...v,shareable:e.target.checked}))}/> 允許會員分享</label>
   <button className="primary" disabled={!form.title.trim()||!form.externalUrl.startsWith('https://')||create.isPending||version.isPending} onClick={()=>target?version.mutate():create.mutate()}>{target?'建立不可變新版本':'建立草稿'}</button>
  </div></Card><Card title="發布操作說明"><p>請在下方各筆草稿旁填寫核准依據，再按「核准發布」。處理中與失敗原因會直接顯示在該筆內容旁。</p><p>發布成功後狀態改為「已發布」；實際顯示依發布範圍與顯示期間。</p></Card></div>}
  <Card title="內容與版本"><div className="table-wrap"><AdminTable><thead><tr><th>內容</th><th>版本</th><th>類型</th><th>狀態</th><th>發布範圍</th><th>顯示期間</th><th>核准／操作</th></tr></thead><tbody>{rows.flatMap(content=>content.versions.map(versionRow=><tr key={versionRow.id}><td><strong>{versionRow.title}</strong>{versionRow.thumbnailUrl&&<img src={versionRow.thumbnailUrl} alt="" style={{width:120,aspectRatio:'16/9',objectFit:'cover',display:'block'}} onError={e=>e.currentTarget.style.display='none'}/>}<br/><a href={versionRow.url} target="_blank" rel="noreferrer">檢視外部內容</a><br/><small className="mono">{content.id}</small></td><td>v{versionRow.version}</td><td>{content.type==='VIDEO_EXTERNAL'?'外部影音':'外部連結'}</td><td><Badge tone={versionRow.status==='PUBLISHED'?'ok':versionRow.status==='DRAFT'?'warn':'neutral'}>{domainLabel(versionRow.status)}</Badge></td><td>{versionRow.audiencePolicy==='PUBLIC'?'官網公開':'會員專用'}</td><td>{versionRow.publishFrom??'立即'}<br/>{versionRow.publishTo?`至 ${versionRow.publishTo}`:'無截止'}</td><td>{versionRow.approvalReference??'尚未核准'}{editable&&content.status==='PUBLISHED'&&versionRow.id===content.versions[0]?.id&&<div>{archiveTarget===content.id?<><p>下架後官網、會員頁與分享入口將停止提供此內容。</p><button disabled={archive.isPending} onClick={()=>archive.mutate(content.id)}>確認下架</button><button onClick={()=>setArchiveTarget('')}>取消</button></>:<button onClick={()=>setArchiveTarget(content.id)}>下架內容</button>}</div>}{editable&&versionRow.status==='DRAFT'&&<PublishContentAction contentId={content.id} versionId={versionRow.id} publishFrom={versionRow.publishFrom} publishTo={versionRow.publishTo} onPublished={refresh}/>}</td></tr>))}</tbody></AdminTable></div>{!rows.length&&!query.isLoading&&<p>尚無內容。</p>}</Card>
 </>;
}
