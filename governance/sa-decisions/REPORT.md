本階段已建立四項 SA Decision/Traceability，修復完整 Backend build，落實月累計 EPV、historical period/snapshot 與保護性 replay。**完整獎金退貨 posting 尚未完成；Production Promotion 仍 BLOCKED。**

[Decision](C:/UCell/UCell/governance/sa-decisions/decisions.json)、[Traceability](C:/UCell/UCell/governance/sa-decisions/traceability.json)、[PASS/FAIL Matrix](C:/UCell/UCell/governance/sa-decisions/final/PASS-FAIL-MATRIX.md)、[修改檔案](C:/UCell/UCell/governance/sa-decisions/changed-files.txt)。完整 commands/exit codes 在 final/gate-results.json；byte-exact raw logs 在 final/raw-logs.zip，hash 在 raw-log-manifest.json；txt 為去除行尾空白的閱讀副本。初始失敗和最後重跑分別保留。最終 SHA 由完成回報提供，不預填。

實作與制度對應：

| 裁決 | 實作 | 未完成 |
|---|---|---|
| SA-01 Return/replay | API/Worker append-only GPV source reversal、idempotent audit marker、transactional replay outbox；replay 依原事件當時 Binary tree、原 finalized period、historical parameters 與 linked reversals。K1/K2 pool/denominator 全期重算、carry 由有效業績重新推導；cut-off/week 不再固定。舊 single-recipient calculate-and-post 改委派 atomic return-scoped replay，回傳 replay run/period evidence，沒有偽造 POSTED batch。 | K0/RPV complete dependency replay、multi-return effective baseline/carry continuation 尚未實作；EPV allocation/posting pending。route 在 partial monetary posting 前阻擋，horizon 未收斂會 rollback。 |
| SA-02 EPV | Qualification + calendar month 累計，max(0, consumption-2000)*60%；三筆1600為0/720/960，合計1680。認列依序使用原付款的 Active/Sponsor snapshot，零額 event 是 consumption idempotent marker。退貨回沖整月累計後重算 threshold，產生 immutable evidence/outbox。 | Return projection 不是正式 EPV monetary reversal/clawback。跨 historical recipient/source events 的差額分攤 pending；其他 consumption eligibility、月內 rule/timezone 改版 pending。既有 REPURCHASE/netAmount eligibility 未自行擴充。 |
| SA-03 Cut-off/snapshot | K0/K1/K2/global/welfare type-scoped period/cut-off/timezone/effective windows；參數 IDs、SHA256 snapshot 持久化，monetary snapshot 鎖在 configured cut-off。period 格式為unit(DAY/WEEK/MONTH)/count/anchorLocal；cut-off為localTime/daysAfterPeriodEnd/approvalReference。缺設定、overlap、corrupt/missing history fail closed。 | 這是配置格式，不是營運核准；沒有 production 日期、timezone、approval seed。Calendar 在 period end 到 cut-off 間改版需 migration policy。EPV calendar timezone 仍須配置。 |
| SA-04 SSOT | 已報備 > 公司正式核准 > R1.0規格 > 討論/海報/舊文件；正式 pools42/36/15/5/2、4800=>1680。舊 golden evidence 沿用 connected-dev-final-review/legacy-test-drift；舊 per-source proportional return shortcut 保存為 legacy-direct-return-posting.txt。 | 文件核准/報備 metadata 是 evidence gap；本次 SA 訊息以 task-supplied authority 紀錄，不冒稱已報備文件。 |

Prisma 只新增 SettlementBatch/GlobalPoolSettlement/WelfarePoolAccrual 三個 nullable snapshot JSON 欄位，17 migrations 已在本機兩個 DEV DB deploy。原 migrations/seed 未修改、historical PAID/Ledger 未覆寫、NULL snapshot 未以今天參數回填。PV/BV 對現有 GPV/RPV/EPV event 的正式映射列 Pending Decision，不自動推定等價。

驗證結果：

- 新增20個 regression tests、18個真實 DB assertions PASS；DB fixtures全部 rollback。驗證月threshold、qualification/month分離、跨threshold退貨、snapshot hash/overlap、cut-off恰好生效參數、event-time tree/later linked reversal、nonzero inactive carry、partial K0 posting阻擋。
- API15 suites/23 executable assertions、Shared6 Golden、Admin4 assertions PASS，共33個 Jest/Vitest executable assertions。148 TODO原檔未刪除/skip/假assertion，新的獨立測試不會替代原148個Release obligations。
- Admin仍以本機 demo/SuperAdmin操作隔離ucell_admin_test；UI4173/API3001/proxy200、既有43 HTTP operations PASS。empty payout、fake fixtures與DEV actor不能替代正式Entra/RBAC、非空獎金金流或UAT。
- Backend/Worker/Admin Build、Prisma validate/generate/migrate、OpenAPI export/preflight、21 offline/static與security policy gates PASS；FAIL gates及commands見完整矩陣。
- 初始existing regression fixture漏新constructor依賴造成TS2554，已更新fixture並保留temporal-plan assertion。初版DB fixture假定可reparent，撞上existing child unique constraint；未放寬DB/制度，改驗證合法mid-period placement生效，失敗證據保留。
- Recovery preflight原本硬性要求退貨函式直接建立recovery，屬Legacy Static Gate Drift；改檢查現行replay owner的outstanding balance、source idempotency、historical period、dependency outbox和incomplete/repeated replay guards。沒有刪除Release guard。Migration preflight接受4-digit repository sequence與14-digit Prisma timestamp，仍檢查完整prefix唯一。

Remaining blockers：

| 分類 | 問題 |
|---|---|
| Application implementation | K0 complete period-wide replay、subscription/RPV downstream replay、multi-return已追加差額effective baseline/carry continuation。這些是尚待完成的工程實作，不要求SA重裁已明確的invariant。新monthly/dependency outbox尚無production consumer，保持PENDING；worker build PASS不代表worker E2E完成。 |
| Pending Decision/configuration | EPV monthly return差額跨historical Active/Sponsor recipients及原EPV events分攤；其他eligible consumption；月內parameter/timezone及end-to-cut-off calendar改版；PV/BV正式event映射；核准operational calendars與EPV timezone。 |
| Historical evidence/Release | 歷史NULL snapshots不能用今天配置回填；完整五球fixture及missing golden-r1-0b.ts、148 TODO、正式Security HTTP E2E/Entra、UAT、非空payout/recovery/backup restore未驗證。 |

148 TODO 分布：bonus-engine-v04 26、epv-global-v05 12、idempotency 4、negative-flow-v05 12、organization 5、qualification-isolation 4、v060 10、v061 18、v062 13、v063 8、v064 11、vertical-slice-02 16、vertical-slice 9。逐項inventory在final/todo-inventory.json；SA已澄清的規則與仍未executable的coverage分開紀錄。

下一階段先補K0/RPV與multi-return完整engine，再依EPV allocation決議實作monetary reversal；由核准資料提供operational calendar與historical snapshots，最後完成五球/非空金流與148 TODO。

每階段修改前已有checkpoint/已驗證階段commit。全部commit在rc1-recovered；沒有merge main、force push、push、RC2或Production promotion。
