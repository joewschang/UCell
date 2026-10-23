import {useResource} from './useResource';
import * as data from './memberData';
import {Link} from 'react-router-dom';
import {UCellIcon,type UCellIconName} from '@ucell/design-system';
import type {Qualification} from './api';
import {MemberPageHeader} from './MemberPageHeader';
const explore:[string,string,string,UCellIconName][]=[['/content','影音中心','認識品牌，找到值得分享的內容','content'],['/events','活動中心','探索近期活動與管理報名','notification'],['/learning','教育訓練','依自己的步調學習','content']];
const business:[string,string,string,UCellIconName][]=[['/organization','我的組織','查看推薦與二元組織','organization'],['/performance','我的業績','查詢月份與業績摘要','income'],['/bonuses','獎金明細','查看結算與入帳紀錄','bonuses'],['/payouts','付款紀錄','確認撥付與處理狀態','income'],['/sharing','我的分享成效','管理商品、活動與影音推薦分享','content'],['/growth','我的成長','查看會員成長資訊','me'],['/repurchase','重購詳情','確認目前球位的重購認列','shop']];
function HubCards({items}:{items:typeof explore}){return <div className="uc-hub-grid">{items.map(([to,title,description,icon])=><Link className="card uc-hub-card" key={to} to={to}><UCellIcon name={icon}/><div><h2>{title}</h2><p>{description}</p></div><span aria-hidden="true">→</span></Link>)}</div>;}
export function ExploreHub(){return <><MemberPageHeader title="探索 UCell"/><p className="uc-page-intro">從一段內容、一場活動，找到生活的新靈感。</p><HubCards items={explore}/></>;}
export function BusinessHub({q}:{q:Qualification}){return <><MemberPageHeader title="我的經營" q={q}/><p className="uc-page-intro">組織、業績與推薦分享，依目前選擇的球位查看。</p><HubCards items={business}/></>;}
export function MemberWelcome(){const person=useResource('home-person',data.getPerson);return <section className="uc-welcome"><small>歡迎回來</small><h1>今天，探索新的美好</h1><p>挑選商品、參與活動，或繼續您的學習。</p><HubCards items={[[ '/shop','商品商城','探索目前上架商品','shop'],['/orders','我的訂單','查看購買與訂單狀態','orders'],['/events','活動中心','探索近期活動','notification'],['/explore','影音與學習','找到喜歡的內容','content']]}/>{person.data&&person.data.membershipState!=='FORMAL_MEMBER'&&<section className="card"><h2>開啟更多會員服務</h2><p>您可以在「我的」管理資料，或了解正式會員申請。</p><Link className="text-link" to="/membership/upgrade">了解正式會員申請 →</Link></section>}</section>;}
