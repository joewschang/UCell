# 已有規格與實作落差盤點

盤點基準：主專案 commit `d7cf494c57d81a1d9d1cdf2878fbbccdc947489c` 的隔離開發副本。主專案其他商務工作持續進行；本表不是所有平行工作最新完成度的替代。

主要規格：`governance/product-next/V1_3_ANALYTICS_SONAR_DETAILED_SPEC.md`、`NEXT_RELEASE_SPRINT_PLAN.md`、Batch1/2 Approved。

| 功能 | 盤點前證據 | 本次狀態／尚缺 |
| --- | --- | --- |
| 基礎期間報表／CSV | admin ReportsPage、admin-ops-ready service 已實作 | 保留；不是 NASL 或雷達完成證據 |
| NASL current | Dashboard 硬編碼 DEFINITION_PENDING | 已新增獨立 policy、來源讀取、保存快照、API、頁面，並修訂過期說明 |
| NASL transition / reactivation | 僅 V1.3 規格 | 已實作保存快照間轉換、再活化、新流失、原活躍者保持比例 |
| NASL trend | 僅規格 | 已有每日最後快照歷史，缺日不補數據；不是回溯生成的歷史 |
| NASL cohort | 僅規格 | 已有現況分布與固定月底母體 M0–M12 留存熱圖，可選日期／政策；來源篩選尚缺 |
| 推薦樹 12 代 Sonar | 只有一般組織樹、無 Sonar API | 已有獨立推薦邊投影、12 軸圖、各代人員／系統球與分項、最多 100 筆證據 |
| Binary 12 代 Sonar | 只有一般 Binary tree | 已有獨立 Binary 投影、左右人數與平衡、各代分項 |
| Heat policy | Batch2 已核准，舊詳細規格仍說 pending | 已版本化、加小樣本門檻與可比快照要求；尚待真實資料校準 |
| Health index | 已有七項權重 | 已實作分項 normalization、覆蓋率與完整性檢核；互動缺資料，因此不產生完整總分 |
| PV/RPV/EPV/Carry 趨勢 | Core 有相關 ledger，Sonar 無 adapter | 已接最近 30 天原事件修正淨量 GPV/RPV/EPV、歷史各代／左右與根球最新已結算 Carry；泛型 PV 不加總，任意期間與 Carry 趨勢尚缺 |
| Analytics projector/checkpoint | 僅規格 | 已有單根範圍有界批次、不可覆寫 snapshot、來源 hash、政策副本、重試去重和寫入互斥；Outbox 增量與事件 checkpoint 尚缺 |
| 15 分鐘鮮度 | 核准 SLO，未見 runtime | 已有 snapshot age／STALE、可設定自動更新服務、重試與狀態 API；預設關閉，實際 SLO 尚待部署驗證 |
| Referral funnel | 有 member/referral-attribution service 與 binding 歷史 | 完整 click→registration→formal→paid 歸因 funnel、歷史鎖定連結與分析頁尚缺 |
| Content analytics | 已有 content service／version 與發布資料 | view/share/click 事件證據及轉換 projection 尚缺，不能把內容篇數當互動 |
| Activities | V1.2 規格，未找到獨立活動 runtime | 活動／報名／簽到 domain 與事件先行，再做漏斗；本次未實作 |
| Message analytics | 有 member notification/read 功能 | MessagePublication/Delivery 的 audience 與完整 delivered/read/click/action 漏斗尚缺 |
| Exception trend | 有 Integrity Alerts、return、recovery 的現況讀取 | 按期間、類型的 exception projector 與安全事件來源尚缺 |
| Controlled analytics export | 一般營運 CSV 已有，但不是 ANALYTICS_EXPORT | 尚缺專用權限、用途稽核、遮罩、筆數與檔案到期管理；本次未借用一般 CSV 權限 |

## 下一輪可執行工作順序

1. 補齊正式 Person 註冊日期與 SYSTEM 所有權／有效期間，處理資料品質拒絕清單；以真實 UAT 資料校準小樣本、風險與熱度。
2. 實作 append-only 有效互動事件和 outbox projector，完成七項健康指標缺口；部署刷新工作並監控超時、拒絕與 STALE。
3. 第三階段已接 GPV/RPV/EPV 與 Carry；接續補任意期間、分區增量及 Carry 趨勢，維持歷史證據與單位分離。
4. cohort-age 留存熱圖與可選日期／政策已完成；接續補來源篩選與真實月底觀測。
5. 接既有 referral / content 的真實事件，建立轉換漏斗；活動與訊息 domain 契約完成後再接相應分析。
6. 專用分析匯出及資料保留維護、效能與運轉 UAT。

本次程式入口：`backend/apps/api/src/modules/analytics/`、`admin/src/features/analytics/`。一般 GET 只讀保存的 projection；`POST /api/v1/admin/analytics/rebuild` 才擷取來源與建立快照。財務或客服頁面權限不被拿來代替此模組的權限。
