# Phase 2 — 共用元件與 Member／Admin 導覽

狀態：已完成核准範圍的本機實作與驗證，尚未合併或部署。

## 授權與基線

使用者在本任務明確回覆「核准上述 Phase 2 範圍」：共用元件與 Member／Admin 導覽；不含 migration、公司球／Reservoir B Core、AI 接入或部署。

- 獨立目錄：`C:\UCell\experience-v2-shell-phase2`
- 分支：`codex/experience-v2-shell-phase2`
- 基線：`935e8a288f0e0891e657175a0f9a4f1afc12a47b`
- 從既有 checkout 的 committed HEAD 複製；沒有帶入其他任務尚未提交的 Provider／migration 修改。
- 相較 Phase 1 的 903b8e9，保留較新基線的 NASL 分析與 Provider 營運入口。

## 完成內容

1. PROCESSING 使用 info 色調；PENDING、PENDING45D、PENDING_45D 在金額與獎金生命週期一致顯示等待狀態。原始狀態值、金額與證據不變；null 不轉為零，零金額仍顯示零。
2. Member 主導覽為「首頁／組織／收益／商城／我的」。業績與獎金皆可由收益分類進入；訂單歸商城，內容與通知歸我的。所有既有路由與零球會員流程保留。
3. Admin 八組：「營運中心／會員與資格／商務／組織／獎金財務／分析中心／治理稽核／系統與發布」。21 個原有入口各出現一次，canOpen、pageRoles 及路由守衛不變。
4. 兩端增加鍵盤跳至主要內容。沿用原生 details 分組鍵盤操作及現有 focus 樣式。
5. 保留 QualificationContext 的伺服器確認、abort、sequence，以及 useResource 的範圍 key。新增 A→B→A 回應重排測試，確認過期 A／B 不覆寫最新 A。

## 驗證

| 檢查 | 結果 |
|---|---|
| Member `pnpm test` | 25 files / 157 tests PASS |
| Admin `pnpm test` | 22 files / 64 tests PASS，含既有權限測試 |
| 後續導覽角色審查 | 新增 AppShell 實際渲染測試 4 項；連同 nav 與 permissions 共 3 files / 12 tests PASS，Admin typecheck PASS |
| Member `pnpm build` | TypeScript + Vite PASS |
| Admin `pnpm build` | TypeScript + Vite PASS；保留 bundle 超過 500 kB 的提示 |
| `node member/tests/phase2-shell.cjs` | Edge headless：11 組檢查 PASS，無 pageerror |
| Member 寬度 | 375／390／430／768，無水平溢出 |
| Admin 寬度 | 768／1366／1440，八組、21 入口、目前分組展開，無水平溢出 |
| 鍵盤與導覽 | 兩端 skip link 確實移動焦點；Member 深連結、歷史、重載及球選擇保留 |
| 放大 | 200% CSS zoom reflow PASS；未宣稱瀏覽器 UI zoom／完整 WCAG 認證 |

瀏覽器測試使用 Member 明示的 DEV mock 與 Admin 攔截回應；所有 Admin API 均攔截，沒有連線實際後端，也不作寫入。圖片僅證明 shell 呈現，不是財務、UAT 或 Production 證據。已人工檢視 member-390.png、admin-1366.png。原始檢查摘要在 `browser-checks.json`，其餘寬度截圖同目錄。

重新執行瀏覽器測試：Member 以 `VITE_ENABLE_MOCK=true` 啟動 Vite 於 127.0.0.1:5184；Admin Vite 於 127.0.0.1:5185。於 member 目錄執行 `node tests/phase2-shell.cjs`。預設使用本機 Edge。

## 邊界

未改動 backend、schema、migration、API、權限規則、lockfile、制度算法與部署設定。PV／GPV 等待原有來源決議，沒有以改標籤方式處理。Phase 1 D1–D9 未因本次 UI 授權而通過。尚未合併、推送或部署；本機差異可供審查。

## 後續差異審查

再次核對所有變更均屬共用顯示、導覽、相關測試與交付證據。新增的 AppShell 渲染測試涵蓋 CUSTOMER_SERVICE、PACKAGE_CONFIG_MANAGE、PACKAGE_CONFIG_APPROVE、MEMBERSHIP_OPS，確認分組後不增加可見路由、不渲染無權限的空組。既有 canOpen 與 pageRoles 不變。完整測試數字以上一輪 64 項與本轮新增 4 項分別記錄，不冒稱重新執行完整套件。
