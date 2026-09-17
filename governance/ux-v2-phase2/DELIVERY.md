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

## 切球與載入體驗補強

原本初始載入、切球確認及確認失敗時，MemberApp 會移除整個 shell，只留下通用文字。現在持續顯示品牌、skip link 與五項導覽，在主要內容區使用共用 LoadingState／ErrorState。切球訊息顯示正在確認的資格代碼與球名稱；待確認資格只用於文字提示，不作為已確認的 current 或資料查詢依據。原有 abort、sequence、server confirmation 與錯誤隔離保持不變。重試會重設載入文字並重新讀取資格清單。

本輪 Member 全部 25 files / 159 tests PASS；TypeScript 與 Vite build PASS。新增兩項 App 整合測試覆蓋初始載入／503 保留導覽，以及切球時隱藏舊資料、403 失敗隔離與重試恢復。沒有修改 CSS、Admin 或後端；前述瀏覽器截圖屬上一輪 shell 驗證，本輪未重新擷取，不作為新增等待／錯誤狀態的視覺驗證。

## 切球鍵盤焦點補強

切球或錯誤重試開始時，焦點先移至持續存在的主要內容區；確認成功後回到資格選單。確認失敗時保留在錯誤內容區。若使用者在等待期間自行將焦點移至導覽，不強制搶回。資格 ID 亦列入恢復判斷，支援快速完成的選取。

驗證：Member 相關 3 files / 33 tests PASS；修正 TypeScript DOM 空值判斷後，最終 TypeScript + Vite build PASS。Edge headless 五項焦點情境 PASS：等待、成功、保留使用者移至導覽的焦點、403 失敗與重試成功。瀏覽器測試攔截所有 API，未連接真實後端。

重現：在 member 目錄以 VITE_ENABLE_MOCK=false 啟動 Vite 於 127.0.0.1:5186，再執行 node tests/qualification-focus.cjs。tests/qualification-focus.html 與 entry.tsx 是測試入口，使用實際 App 與 QualificationProvider，跳過 LIFF 啟動；不列入 production build 入口。
## 最新整合基線相容性

已將 integration/member-backend-mvp 的已提交版本 462930c 合入獨立 Phase 2 分支，merge commit 為 1534f85，沒有衝突。來源 checkout 的未提交 backend/packages/database/src/provider/ 未帶入，來源 checkout 未修改。

重新執行：Member 25 files / 159 tests PASS；Admin 23 files / 73 tests PASS；兩端 TypeScript 與 Vite build PASS。Admin 仍有大於 500 kB 的 bundle 提示。此次未重跑瀏覽器；前述瀏覽器結果各對應其原先實作版本。

相對 462930c 的交付差異僅在 Member、Admin、shared/design-system 與 governance/ux-v2-phase2。從較早基線繼承的 Provider migration 與 AI-ready 檔案屬其他工作已提交內容，本任務未編寫或執行這些 migration／AI 功能，也未重跑 backend 驗證。整合檢查不代表制度決議、上線或資料庫變更授權。此分支已包含所核對的整合基線，尚未推送或合回主整合分支。