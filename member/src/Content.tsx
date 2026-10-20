import {uiText} from '../../shared/design-system/i18n';
import {useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {EmptyState,ErrorState,LoadingState} from '@ucell/design-system';
import type {Qualification} from './api';
import {getContent,getContentDetail,type MemberContent} from './memberData';
import {useResource} from './useResource';
import ReferralShare from './ReferralShare';
import {MemberPageHeader} from './MemberPageHeader';
import {ContentCover,ContentMedia} from './ContentMedia';
export function ContentCard({row}:{row:MemberContent}){return <article className="card uc-content-card"><Link to={`/content/${row.id}`} tabIndex={-1} aria-hidden="true"><ContentCover src={row.thumbnailUrl} title={row.title}/></Link><div className="uc-content-card-body"><small>{row.type==='VIDEO_EXTERNAL'?'影音':'閱讀素材'} · {row.audiencePolicy==='PUBLIC'?'公開內容':'會員專用'}</small><h2><Link to={`/content/${row.id}`}>{row.title}</Link></h2>{row.summary&&<p>{row.summary}</p>}<Link className="text-link" to={`/content/${row.id}`}>探索內容 →</Link></div></article>}
export function ContentList({q}:{q?:Qualification}){
 const state=useResource('content',getContent),[query,setQuery]=useState(''),[filter,setFilter]=useState('ALL');if(state.error)return <ErrorState message={state.error} retry={state.retry}/>;if(!state.data)return <LoadingState/>;
 const rows=state.data.filter(r=>(filter==='ALL'||r.type===filter)&&`${r.title} ${r.summary??''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 return <><MemberPageHeader title="影音中心" q={q}/><div className="uc-content-intro"><div><small>{uiText('UCELL 精彩內容')}</small><h2>從一段內容，開啟更多可能</h2><p>探索品牌影音與閱讀素材，將喜歡的內容分享給朋友。</p></div>{q&&<Link className="button" to="/sharing">我的分享成效 →</Link>}</div><div className="uc-content-toolbar"><label>搜尋內容<input type="search" placeholder="輸入標題或關鍵字" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="uc-content-actions" aria-label="內容分類">{[['ALL','全部'],['VIDEO_EXTERNAL','影音'],['EXTERNAL_LINK','閱讀素材']].map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div></div><p role="status">{rows.length} 則內容</p>{rows.length?<div className="uc-content-grid">{rows.map(row=><ContentCard key={row.id} row={row}/>)}</div>:<EmptyState title={state.data.length?'沒有符合的內容，試試其他關鍵字':'精彩內容準備中，歡迎稍後再來看看'}/>}</>;
}
export function ContentDetail({q}:{q?:Qualification}){
 const {id=''}=useParams(),state=useResource(`content:${id}`,signal=>getContentDetail(id,signal));if(state.error)return <><Link to="/content">← 返回影音中心</Link><ErrorState message={state.error} retry={state.retry}/></>;if(!state.data)return <LoadingState/>;
 const row=state.data;return <><MemberPageHeader title="影音中心" q={q}/><Link className="text-link" to="/content">← 返回影音中心</Link><article className="card uc-content-detail"><small>{row.audiencePolicy==='PUBLIC'?'公開內容':'會員專用'}</small><h1>{row.title}</h1><p className="uc-content-summary">{row.summary}</p><ContentMedia key={row.versionId} url={row.url} title={row.title} thumbnailUrl={row.thumbnailUrl}/><small>更新於 {new Date(row.publishedAt).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'})}</small></article>{row.shareable&&q&&<ReferralShare key={`${q.id}:${id}`} q={q} contentId={id} title={row.title}/>}<section className="card"><h2>繼續探索 UCell</h2><div className="uc-content-actions"><Link className="button" to="/shop">探索商品</Link><Link className="button" to="/events">近期活動</Link><Link className="button" to="/content">更多影音</Link></div></section></>;
}
