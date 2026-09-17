import {useQuery} from '@tanstack/react-query';
import {AdminTable} from '../../components/AdminTable';
import {Badge,Card,PageHeader} from '../../components/ui';
import {QueryFeedback} from '../../components/QueryFeedback';
import {get} from '../../lib/api';

type ProductRule={productRuleProfileId:string;minQty:number|null;maxQty:number|null;selectionIncrement:number;sortOrder:number;status:string};
type PackageVersion={packageProfileVersionId:string;version:number;displayName:string;currency:string;priceAmount:string;selectableProductQuantity:number;selectionMode:string;membershipEffect:string;qualificationEffect:string;targetQualificationRequired:boolean;status:'DRAFT'|'APPROVED'|'SCHEDULED'|'ACTIVE'|'RETIRED';effectiveFrom:string|null;effectiveTo:string|null;salesFrom:string|null;salesTo:string|null;approvalReference:string|null;configHash:string;selectableProducts:ProductRule[]};
type PackageProfile={packageProfileId:string;stableCode:string;packageClass:'QUALIFICATION'|'ACTIVE_DURATION'|'FUTURE';status:string;versions:PackageVersion[]};
const tone=(status:PackageVersion['status'])=>status==='ACTIVE'?'ok':status==='DRAFT'?'warn':'neutral';

export function PackagesPage(){
 const query=useQuery({queryKey:['packages'],queryFn:()=>get<{data:PackageProfile[]}>('/admin/packages')});
 const rows=query.error?[]:query.data?.data??[];
 return <><PageHeader title="套組與資格商品" subtitle="Core 套組版本、正式價格與可選商品池的唯讀營運檢視。"/>
  <div className="callout info"><strong>Core authoritative：</strong>前台只提交套組版本及商品數量。價格、資格效果、認列與訂單金額均由 Backend 依已核准版本處理。</div>
  <QueryFeedback query={query} empty={!rows.length}/>
  <Card title="套組版本清單"><div className="table-wrap"><AdminTable><thead><tr><th>套組</th><th>版本／狀態</th><th>正式價格</th><th>選品規則</th><th>期間</th><th>核准與雜湊</th></tr></thead><tbody>{rows.flatMap(profile=>profile.versions.map(version=><tr key={version.packageProfileVersionId}><td><strong>{version.displayName}</strong><br/><small>{profile.stableCode} · {profile.packageClass}</small></td><td>v{version.version}<br/><Badge tone={tone(version.status)}>{version.status}</Badge></td><td>{version.currency} {version.priceAmount}</td><td>{version.selectionMode} · {version.selectableProductQuantity} 件<br/><small>{version.selectableProducts.length} 個可選 Product Rule Profile</small></td><td>{version.salesFrom??version.effectiveFrom??'尚未排程'}<br/>{version.salesTo??version.effectiveTo?`至 ${version.salesTo??version.effectiveTo}`:'無截止'}</td><td>{version.approvalReference??'尚未核准'}<br/><small className="mono" title={version.configHash}>{version.configHash.slice(0,12)}…</small></td></tr>))}</tbody></AdminTable></div>{!rows.length&&!query.isLoading&&<p>尚無套組設定。</p>}</Card>
  <Card title="治理界線"><p>此頁不在瀏覽器計算 PV、BV、資格效果或應付金額。DRAFT、APPROVED、SCHEDULED、ACTIVE、RETIRED 狀態均直接讀取 Core；Production 排程值仍須正式核准。</p></Card></>;
}
