# 套組選購 Person 入口修正 2026-10-15

正式機日誌 2026-10-15 00:26:36（台北）確認 GET /api/v1/member/represented-legal-entities 被 MemberContextGuard 回應 QUALIFICATION_CONTEXT_REQUIRED。QualificationPackageShop 在代表法人清單查詢失敗時停用選擇套組按鈕，故無 Ball 的網路會員也不能以本人名義購買。

修正：只將上述 GET 本人代表權查詢改為 Person 層級，不要求 qualificationId；登入驗證保留，service 依登入 personId 篩選目前有效代表權。沒有法人代表權時回傳空陣列，前台本人選項正常可用。POST 同路徑不放寬。

測試：member-context-audit 與 formal-enrollment-db 共 19 案例通過；162 DB 基線 assertions 通過。前台 entry-package-journey 的 3/9/15 盒混選與結帳三案例通過（隔離 mock Stage 情境，並非正式付款）。未替使用者建立訂單或付款。

證據：C:/UCell/logs/package-context-fix-20261015.log；C:/UCell/logs/package-ui-check-20261015.log。

部署完成：ucell-prod-api--0000006；Healthy / Running / 100% traffic；image sha256:e7a35acbfd9146d4c933f502ed3df1e941ecc9a14287c82d672c22623abdee00。正式 health 200，未登入代表權查詢仍 401；登入會員本人選購驗收待重試。
