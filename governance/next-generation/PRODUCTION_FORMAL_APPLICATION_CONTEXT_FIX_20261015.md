# 正式申請入口修正 2026-10-15

會員 2610000002 回報正式申請儲存顯示一般驗證錯誤。正式 API 在 2026-10-15 00:12:41、00:12:51（台北時間）記錄 POST /api/v1/member/formal-applications 回應 QUALIFICATION_CONTEXT_REQUIRED / 422。

唯讀查核：會員仍為 NETWORK_MEMBER；正式申請資料 0 筆、600 元費用訂單 0 筆。正式會員合約同意已於 00:12:40 保存。未讀取或解密銀行及身分證資料，未代替會員提交申請。

原因：MemberController 的 MemberContextGuard 未將 Person 層級正式申請路由排除於 Qualification 必填檢查。修正僅開放正式申請儲存、本人目前申請及文件讀寫四種既有端點；MemberAuthenticationGuard 仍先驗證登入，各 service 仍驗證申請所有權。其他路由不放寬。

驗證：member-context-audit 及 formal-membership-approval 共 13 測試通過；162 項真實 DB 基線 assertions 通過，隔離資料庫清除完成。

後台：/applications，會員管理 → 會員申請 → 正式會員申請區，選全部狀態並搜尋會員編號。成功儲存為 DRAFT；另點送出後才為 SUBMITTED 並建立待付款 600 元訂單。

查核證據：C:/UCell/releases/production-20261014/member-application-check-20261015.json。
測試證據：C:/UCell/logs/formal-context-fix-20261015.log。

正式部署完成：ucell-prod-api--0000005，Healthy / Running / 100% 流量。image sha256:cd8c78fd135fc13c6af53b40e27d9f0c40ed990ccf16a50b0f3b6ce2a2b810cf。正式 /health 200；未登入 /member/formal-applications/current 401。使用者本人重新儲存驗收待進行。
