import {ApiWorkbench} from '../../components/Workbench';
export function SubscriptionsPage(){return <ApiWorkbench title="季／半年／年重銷方案" subtitle="預收款分3/6/12期逐月Recognition，不在付款當日一次生成全部RPV。" actions={[
 {label:'查詢方案清單',method:'GET',path:()=>'/admin/subscriptions/plans'},
 {label:'建立 Subscription',method:'POST',path:()=>'/admin/subscriptions'},
 {label:'查詢 Subscription',method:'GET',path:id=>`/admin/subscriptions/${id}`},
 {label:'取消 Subscription',method:'POST',path:id=>`/admin/subscriptions/${id}/cancel`}
]}/> }
