import {AdminTable} from '../../components/AdminTable';
import {backendRoutes,backendRouteSnapshot} from '../../lib/routes';
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
 return <><PageHeader title="系統參考與待辦" subtitle="此頁提供 UI 維護用的靜態參考；即時 API contract、Release Gate 與 Production readiness 應查閱各自的正式 evidence。"/>
 <div className="grid two"><Card title="Backend route 靜態快照"><p><strong>{backendRoutes.length}</strong> 筆經挑選的 Admin/Health operation。</p><p><Badge tone="neutral">Static snapshot</Badge> <Badge tone="warn">Known drift</Badge></p><dl><dt>盤點日期</dt><dd>{backendRouteSnapshot.asOf}</dd><dt>來源</dt><dd>{backendRouteSnapshot.source}</dd><dt>範圍</dt><dd>{backendRouteSnapshot.scope}</dd><dt>API contract SSOT</dt><dd className="mono">{backendRouteSnapshot.authoritativeSource}</dd></dl><p>盤點時 OpenAPI 為 {backendRouteSnapshot.knownOpenApiPathCountAtAudit} paths / {backendRouteSnapshot.knownOpenApiOperationCountAtAudit} operations；此清單不完整，也不是即時健康檢查或 Release Gate。</p></Card>
 <Card title="Admin MVP v0.6.0"><p>本版完成Microsoft Entra登入交換、短效Backend Session、Production-safe RBAC/UAT Console與Release Preparation。</p><p>所有制度金額都由Backend計算。</p></Card></div>
 <Card title="仍需完成"><div className="table-wrap"><AdminTable><thead><tr><th>項目</th><th>時點</th></tr></thead><tbody>{gaps.map(g=><tr key={g[0]}><td>{g[0]}</td><td>{g[1]}</td></tr>)}</tbody></AdminTable></div></Card>
 <Card title={`Backend route 靜態參考（as of ${backendRouteSnapshot.asOf}）`}><div className="table-wrap"><AdminTable><thead><tr><th>Method</th><th>Path</th><th>用途</th></tr></thead><tbody>{backendRoutes.map(r=><tr key={r.method+r.path}><td>{r.method}</td><td className="mono">{r.path}</td><td>{r.label}</td></tr>)}</tbody></AdminTable></div></Card>
 </>;
}
