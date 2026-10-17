import {uiValue,uiText} from "../../../../shared/design-system/i18n";
import {AdminTable} from '../../components/AdminTable';
import {backendRoutes,backendRouteSnapshot} from '../../lib/routes';
import {Badge,Card,PageHeader} from '../../components/ui';

const gaps=[

 [uiText("Entra live tenant login + JWKS verification UAT"),uiText("RC blocker")],
 [uiText("LINE official token verification"),uiText("Member/LINE OA phase")],
 [uiText("Automated bank execution / bank API integration"),uiText("External integration; manual reconciliation now supported")],

 [uiText("Share / Referral Attribution full model & API"),uiText("Before LINE OA")],
 [uiText("Attachment/original document management"),uiText("Before paperless production ops")],
 [uiText("Fulfillment/Lot/Serial/Shipment"),uiText("Before interim logistics without ERP")],
 [uiText("Integration Inbox / External Reference"),uiText("Before D365 integration")],
 [uiText("Full hierarchical Rule Registry"),uiText("Before future Rule Version operations")],

];
export function SystemPage(){
 return <><PageHeader title="系統參考與待辦" subtitle={uiText("此頁提供 UI 維護用的靜態參考；即時 API contract、Release Gate 與 Production readiness 應查閱各自的正式 evidence。")}/>
 <div className="grid two"><Card title={uiText("Backend route 靜態快照")}><p><strong>{backendRoutes.length}</strong> {uiText(" 筆經挑選的 Admin/Health operation。")}</p><p><Badge tone="neutral">{uiText("Static snapshot")}</Badge> <Badge tone="warn">{uiText("Known drift")}</Badge></p><dl><dt>盤點日期</dt><dd>{backendRouteSnapshot.asOf}</dd><dt>來源</dt><dd>{backendRouteSnapshot.source}</dd><dt>範圍</dt><dd>{backendRouteSnapshot.scope}</dd><dt>{uiText("API contract SSOT")}</dt><dd className="mono">{backendRouteSnapshot.authoritativeSource}</dd></dl><p>{uiText("盤點時 OpenAPI 為 ")}{backendRouteSnapshot.knownOpenApiPathCountAtAudit} {uiText(" paths / ")}{backendRouteSnapshot.knownOpenApiOperationCountAtAudit} {uiText(" operations；此清單不完整，也不是即時健康檢查或 Release Gate。")}</p></Card>
 <Card title={uiText("Admin MVP v0.6.0")}><p>{uiText("本版完成Microsoft Entra登入交換、短效Backend Session、Production-safe RBAC/UAT Console與Release Preparation。")}</p><p>{uiText("所有制度金額都由Backend計算。")}</p></Card></div>
 <Card title="仍需完成"><div className="table-wrap"><AdminTable><thead><tr><th>項目</th><th>時點</th></tr></thead><tbody>{gaps.map(g=><tr key={g[0]}><td>{uiValue((g[0]))}</td><td>{uiValue((g[1]))}</td></tr>)}</tbody></AdminTable></div></Card>
 <Card title={`Backend route 靜態參考（as of ${backendRouteSnapshot.asOf}）`}><div className="table-wrap"><AdminTable><thead><tr><th>{uiText("Method")}</th><th>{uiText("Path")}</th><th>用途</th></tr></thead><tbody>{backendRoutes.map(r=><tr key={r.method+r.path}><td>{r.method}</td><td className="mono">{r.path}</td><td>{uiValue((r.label))}</td></tr>)}</tbody></AdminTable></div></Card>
 </>;
}
