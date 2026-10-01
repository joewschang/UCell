import {ErrorState,EmptyState,LoadingState} from '@ucell/design-system';
import {getWebRetailOrders} from './memberData';
import {useResource} from './useResource';
const labels:Record<string,string>={DRAFT:'草稿',CONFIRMED:'已建立',PAID:'已付款',FULFILLED:'已履約',PARTIAL_RETURN:'部分退貨',RETURNED:'已退貨',VOIDED:'已作廢'};
export default function WebRetailOrders(){
 const state=useResource('person-retail-orders',getWebRetailOrders);
 return <section className="card"><h2>我的零售訂單</h2><p>顯示本人最近最多 100 筆零售訂單，不依目前經營資格篩選。此清單呈現保存的訂單狀態。</p><button onClick={state.retry}>重新整理零售訂單</button>{state.error?<ErrorState message={state.error} retry={state.retry}/>:!state.data?<LoadingState label="訂單載入中…"/>:!state.data.length?<EmptyState title="尚無零售訂單"/>:<ul>{state.data.map(order=><li key={order.orderNo}><strong>訂單 {order.orderNo}</strong><p>{labels[order.status]??'狀態尚未提供'} · NT$ {order.total} · {order.itemCount} 件</p><p>建立時間：{new Date(order.createdAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}</p>{order.itemNames.length>0&&<p>{order.itemNames.join('、')}</p>}</li>)}</ul>}</section>;
}
