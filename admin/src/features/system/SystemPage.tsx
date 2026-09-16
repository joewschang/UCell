import {AdminTable} from '../../components/AdminTable';
import {backendRoutes} from '../../lib/routes';
import {Badge,Card,PageHeader} from '../../components/ui';

const gaps=[
 
 ['Entra live tenant login + JWKS verification UAT','RC blocker'],
 ['LINE official token verification','Member/LINE OA phase'],
 ['Automated bank execution / bank API integration','External integration; manual reconciliation now supported'],
 
 ['Share / Referral Attribution full model & API','Before LINE OA'],
 ['Attachment/original document management','Before paperless production ops'],
 ['Fulfillment/Lot/Serial/Shipment','Before interim logistics without ERP'],
 ['Integration Inbox / External Reference','Before D365 integration'],
 ['Full hierarchical Rule Registry','Before future Rule Version operations'],
 
];
export function SystemPage(){
 return <><PageHeader title="系統就緒度" subtitle="此頁刻意區分『UI已可開始』與『Production尚未完成』，避免介面進度掩蓋後端RC Gate。"/>
 <div className="grid two"><Card title="Backend Contract"><p><strong>{backendRoutes.length}</strong> 個已知 Admin/Health route。</p><p><Badge tone="ok">Reviewed v0.6.10-R4 Offline Gate PASS</Badge></p><p><Badge tone="warn">Dependency/DB RC Gate pending</Badge></p></Card>
 <Card title="Admin MVP v0.6.0"><p>本版完成Microsoft Entra登入交換、短效Backend Session、Production-safe RBAC/UAT Console與Release Preparation。</p><p>所有制度金額都由Backend計算。</p></Card></div>
 <Card title="仍需完成"><div className="table-wrap"><AdminTable><thead><tr><th>項目</th><th>時點</th></tr></thead><tbody>{gaps.map(g=><tr key={g[0]}><td>{g[0]}</td><td>{g[1]}</td></tr>)}</tbody></AdminTable></div></Card>
 <Card title="Backend Routes"><div className="table-wrap"><AdminTable><thead><tr><th>Method</th><th>Path</th><th>用途</th></tr></thead><tbody>{backendRoutes.map(r=><tr key={r.method+r.path}><td>{r.method}</td><td className="mono">{r.path}</td><td>{r.label}</td></tr>)}</tbody></AdminTable></div></Card>
 </>;
}
