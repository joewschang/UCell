import {useQuery} from '@tanstack/react-query';
import {useAuth} from '../features/auth/auth';
import {get} from '../lib/api';
import {Card} from './ui';
type Kind='PRODUCT'|'EVENT'|'CONTENT';
const copy={PRODUCT:{name:'商品',path:'/shop',steps:['確認商品圖片、售價與可購買方案','會員於商品方案展開「分享商品給朋友」','訪客查看商品，登入後返回同一商品','結帳付款後依訂單推薦快照認列']},EVENT:{name:'活動',path:'/events',steps:['建立活動草稿並核准發布','會員於活動詳情建立活動分享連結','訪客查看活動，登入後返回同一活動','會員確認報名，後台名冊追蹤報到與出席']},CONTENT:{name:'影音',path:'/content',steps:['建立內容，設定發布範圍與允許分享','核准發布，確認顯示期間','會員開啟內容，建立專屬分享連結','公開內容直接瀏覽；會員內容登入後觀看']}};
export function RecommendationFlow({kind}:{kind:Kind}){
 const c=copy[kind],{user}=useAuth(),allowed=['SUPER_ADMIN','ORDER_OPS','COMPLIANCE_AUDIT'].includes(user?.role??'');
 const query=useQuery({queryKey:['recommendation-flow-insights'],queryFn:()=>get<{data:{asOf:string;rows:{targetType?:string;title:string|null;links:number;visitors:number;boundMembers:number;registrations:number}[]}}>('/admin/content-insights'),enabled:allowed&&kind!=='CONTENT'});
 const rows=(query.data?.data.rows??[]).filter(r=>r.targetType===kind);
 return <Card title={`${c.name}推薦流程`}><ol className="recommendation-steps">{c.steps.map(step=><li key={step}>{step}</li>)}</ol><p>會員必須使用自己的球位建立專屬推薦連結；下方「查看會員頁」只供確認入口，不會建立推薦歸屬。</p><a className="button" href={'https://member.ucell.life'+c.path} target="_blank" rel="noopener noreferrer">查看會員{c.name}頁 ↗</a><p><small>LINE、複製連結與 二維條碼 共用同一推薦來源。活動分享不保留名額；影音造訪不等於觀看完成；分享量不等於成交或獎金。</small></p>
 {kind!=='CONTENT'&&allowed&&<details><summary>查看{c.name}分享成效（近 30 天）</summary><button disabled={query.isFetching} onClick={()=>void query.refetch()}>更新成效</button>{query.isPending?<p role="status">正在載入分享成效…</p>:query.error?<p role="alert">成效讀取失敗，請重試；商品與活動管理仍可使用。</p>:rows.length?<div className="table-wrap"><table><thead><tr><th>名稱</th><th>連結</th><th>有效造訪</th><th>已連結會員</th><th>新註冊會員</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td>{r.title??'名稱未提供'}</td><td>{r.links}</td><td>{r.visitors}</td><td>{r.boundMembers}</td><td>{r.registrations}</td></tr>)}</tbody></table><p>同一人可出現在不同內容，人數不可直接加總。</p></div>:<p>目前沒有此類型的分享紀錄。</p>}</details>}
 </Card>;
}
