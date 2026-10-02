# UCell R1.0B 規則對齊與會員經營資格生命週期補充規格

Status: PRODUCT OWNER APPROVED — SPECIFICATION ONLY
DocumentVersion: 1.0
ApprovedOn: 2026-10-03 (Asia/Taipei)
ApprovalReference: Product Owner 在本次規則對照後核准「依照你的建議執行，更新 GitHub 規格與 Google Drive 規格文件」。
Baseline: R1.0B FROZEN + Decision Register v3 + 2026-09-17 boundary/volume decisions + 2026-10-02 membership/identity/multi-auth decisions.
AmendmentId: R1.0B-AMEND-20261003
BusinessEffectiveFrom: NOT SET
ImplementationStatus: NOT VERIFIED BY THIS SPECIFICATION UPDATE
DeploymentStatus: NOT DEPLOYED BY THIS SPECIFICATION UPDATE

本文件核准規則與文件對齊方向，並明定 600 元入會、每球連續十二個月未活躍及回收邊界。規格核准日不等於契約、公告、報備或正式系統生效日。既有封版獎金比例不因本次規格更新而改變。

## 1 效力與取代範圍

- 法定權利、有效報備及契約、公司正式核准文件、R1.0B 系統規格、核准補充決議依既有治理順序處理。不能以檔名日期或工程提交覆蓋較高效力條款。
- 本補充取代規格中「單次 EPV」「一律加 45×24 小時」「正式會員必須先購資格套組」及「取消單球資格等於刪除會員帳號」等相衝突解讀，僅限相應事項及核准生效範圍。
- 實際有效契約中的單一組織權利、參加成立条件及期限條文，須另完成逐條對齊及適用程序；本次不改写已簽契約、既有報備原件或歷史交易。
- 遇到權利或金額衝突，只阻擋受影響的新權益路徑並保留審查證據；不以此停止無關購物、法定退款或已成立權利的必要處理。

## 2 核准規則對齊表

| 規則 ID | 核准口徑 | 取代或待對齊範圍 |
|---|---|---|
| ALIGN-01 | 參加人身分與持球數分開；同一核准主體可持多球，每球 Active、直推、業績、Carry、組織與獎金獨立。夫妻及法人防繞道限制仍適用。 | 單一組織權利條文的法律及契約含義須確認，不直接刪除限制或擴張權利。 |
| ALIGN-02 | 現行 R1.0B RPV 基準每月 1,200 RPV，沿 Binary Tree 每代 100 元，有效直推 0/1/2+ 解鎖 5/8/12 代。 | C3 A 型 6×200 的有效 SKU、適用會員與終止日待核實。不得推定廢止、轉換或混用。 |
| ALIGN-03 | EPV 沿 Sponsor Tree：本人 50%，G1–G5 各 6%；固定代數、不壓縮、不替補。 | C3 第十四章 Binary Tree 文字須正式對齊，不能作第二套現行 EPV 路由。 |
| ALIGN-04 | EPV = max(0, 同球同曆月合格重購累積額 − 2,000) × 60%；與 Active 共用權威累積器。 | 取代單次扣門檻文字；兩筆各 1,500 元合計產生 600 EPV。退貨重算原月。 |
| ALIGN-05 | 推薦及推薦對等共用 GPV 42% 池；K0 = min(1, 池額 / 同結算窗口理論總額)。 | 文件、例子及參數表須同時揭露 K0。理論總額為零時不產生付款，比例實作沿有效引擎規則，不新增經濟分配。 |
| ALIGN-06 | 10 日批次名義付款日為次月 25 日；25 日批次為隔兩個月 10 日；非營業日依有效日曆順延。 | 取代固定 45×24 小時解讀；10/25 截止 00:00、週日週結及半開區間仍依 9/17 決議。 |
| ALIGN-07 | 法人本身持球，代表人為代理；夫妻一正式經營單位、防跨線及人工衝突審查沿 10/2 核准規格。 | 自然人限定文字待文件採用後取代；婚姻或代表變更不自動刪球、搬樹或改歷史。 |
| ALIGN-08 | LINE、Google OIDC、會員編號密碼、手機 OTP 共用同一會員身分。帳號連結必須驗證。 | 多重登入決議取代 LINE-only；email 相同不能自動合併；未設定 provider 不得宣稱啟用。 |
| ALIGN-09 | 72 小時安置、BFS 及 next-release 商品配置維持未來版本範圍。 | 本補充不將預排保留期限定為 72 小時，也不由設計核准推定正式啟用。 |

## 3 正式會員與經營資格分離

MEM-01：申請人提交會員申請表、繳交 NT$600 入會費，通過適用契約同意、KYC、夫妻／跨線、法人及其他審核後，取得正式會員身分。單純付款、保存草稿或送審均不表示核准。

MEM-02：正式會員可商城購物及申請預排球位。未購買核准資格套組並完成經營資格核准前，不建立正式 Qualification/Ball，不取得 Sponsor/Binary 正式經營位置，不計組織獎金、不取得領獎權。一般購物不得自行轉換為資格取得事件。

MEM-03：網路／消費帳號、正式會員審核狀態、每球經營資格、每球每月 Active 及獎金可付狀態分開記錄。以下為邏輯狀態，實作可使用等義名稱，但不得合併權益：

- 會員審核：DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED / WITHDRAWN。
- 預排保留：REQUESTED → RESERVED → CONVERTED / RELEASED / EXPIRED / CANCELLED。
- 每球經營資格：NOT_CREATED → OPERATING → RECLAIM_REVIEW → COMPANY_SUCCEEDED；每月 Active 是獨立維度。

MEM-04：入會費、升級審核費、轉讓審核費使用不同費目及事件，不因皆為 600 元而互相抵用或推定相同退還規則。入會費本身不生成 GPV/RPV/EPV、Active 或獎金；若未來要變更，須另有明示核准及有效產品／規則版本。

## 4 預排位置與正式建球

RES-01：預排是位置保留紀錄，不是正式球。保存 reservationId、核准會員主體、預計推薦球／安置父球與左右側、建立時間、保留規則版本、狀態與操作證據；不得製造獎金來源或正式雙樹邊。

RES-02：正式建球須有有效套組購買／認列、資格審核、KYC 及衝突檢查證據。以冪等且原子方式重新驗證位置可用性，再將保留轉為正式球；重試不得重複建球。預排不繞過既有第 1／第 3 位直推安置限制。

RES-03：保留期限、優先次序、同位置衝突處理、逾期釋放及套組退款前後的保留處理為啟用前必填參數。尚未核准具體值時，系統不得自行永久占位或套用 next-release 的 72 小時。

## 5 每球連續十二個月未活躍

LIFE-01：回收判定單位為 Qualification/Ball。單一球回收不取消該主體的消費帳號或其他有效球；不得用同一主體其他球的消費補足門檻。

LIFE-02：未購套組、尚未正式啟用的會員及預排紀錄不計十二月未活躍，不因沒有球而被回收。

LIFE-03：新球從正式啟用後第一個完整 Asia/Taipei 曆月起算。若在某月 1 日 00:00 正式啟用且該月完整受規則覆蓋，可從該月起算；其他時點從下月起算。既有球以公告採用生效時間為下限，從第一個完整適用曆月起算，不追溯累算生效前月份。

LIFE-04：月結使用同球同月權威合格消費累積額：達 NT$2,000 時，連續未活躍月數歸零；未達則加一。必須是十二個相鄰適用曆月均未活躍，不能把不相鄰月份相加。此月結判定不改變獎金事件時點 Active、不回補達標前獎金。

LIFE-05：第十二個未活躍月結束後建立 RECLAIM_REVIEW；完成通知、異議期限、必要人工確認及回收證據後，才於明確 effectiveAt 取消該球原持有人的未來經營資格並由指定公司主體承接。背景作業執行時間不得倒填為業務生效時間。

LIFE-06：每月站內通知列球號、當月合格消費額、連續未活躍月數、權益與恢復方式；第 11、12 個月另有提醒。保存訊息內容版本、建立／送達／讀取證據與失敗重試。同一球同月同通知類型不得重複寄發；未讀不能冒充已送達或同意。

LIFE-07：Return POSTED 重算原月 Active 與連續計數。若重播新增回收條件，先追加審查與通知，不在退款入帳時立即自動回收；已回收球的歷史更正進人工審查，不靜默恢復、刪除或倒改 Holder。退款處理與回收異議相互獨立。

LIFE-08：回收保留球 ID、Sponsor/Binary 位置、Carry、取得與持有人歷史及獎金證據。既有待付／已付獎金及追回款依原有效版本處理，不因回收自動歸零或轉入公司。原持有人於承接 effectiveAt 後停止該球未來權益；公司未來權益依指定公司主體及有效規則，不能自動假定 Active。

## 6 啟用前待補事項

下列為執行參數或證據待補，不表示已核准原則仍待決，也不得編造數值或日期。

| 編號 | 待補內容 | 阻擋範圍 |
|---|---|---|
| GATE-01 | 有效送件、契約、公告與條文對齊清單；單一組織权利與多球關係；法人／夫妻採用證據。 | 受影響的新經營資格及對外條款採用。 |
| GATE-02 | 新規則公告生效日、RuleVersion、參數版本、既有會員通知及過渡名單。 | 十二月計數正式啟用及回收。 |
| GATE-03 | 預排保留期限、位置衝突、釋放、退款與轉正式球政策。 | 正式預排服務。 |
| GATE-04 | 入會審核失敗／撤回與各費目退還、重申請處理。 | 費用正式收取及退還流程；不得以空白政策限制既有退款。 |
| GATE-05 | 回收異議期限、審查及承接權限、指定公司主體、回收後各權益歸屬清單、恢復／重申請程序。 | 公司承接及恢復資格。 |
| GATE-06 | RPV A 型有效商品／會員／報備核查。 | A 型處理或遷移；不阻擋已明確核准 B 型規格整理。 |
| GATE-07 | 系統實作、測試、UAT、通知與回收稽核、正常發布門檻及啟用證據。 | 正式系統啟用；規格提交不等於已通過。 |

## 7 資料與驗收要求

每條規則保存 ruleId、適用主體、sourceReference、supersedesScope、approvalStatus、businessEffectiveFrom、RuleVersion、ParameterVersion、filing/contract/announcement reference、implementation/UAT/deployment status。批准狀態與工程狀態分開。

每球每月保存 month、eligibleAmount、activeAtMonthClose、consecutiveInactiveMonths、countingStartMonth、計算／重播版本、sourceCutoff、review/notification references。遲到事件或重播追加新版本，不覆寫原證據；遷移不得用目前 Holder 回填歷史。

至少驗收以下案例並保存實際結果，不能以本清單表示測試已通過：

1. 600 元已付但審核未通過，不建球；通過但未購套組，可購物／預排但無組織獎金。
2. 同一套組或預排轉換重試，只建立一球；位置被占時保留明確衝突結果。
3. 月底啟用不計不完整月；月初 00:00 啟用計完整當月。
4. 同一主體 A 球達標、B 球未達標，僅 A 計數歸零。
5. 十一月未活躍後第十二月達標，歸零、不回收；十二個不相鄰月未活躍不回收。
6. 生效前十二月未活躍不直接觸發新規則回收；既有球向未來起算。
7. Return POSTED 降低原月消費，重算 Active/EPV/計數並審查，不能立即刪球。
8. 通知失敗重試不重複寄發；第 11、12 月提醒及回收異議證據完整。
9. 回收仍保留雙樹、Carry 與原待付獎金；公司承接不取得原持有人歷史獎金。
10. 法人換代表或既有會員結婚，只更新有效區間／人工衝突，不改球位與歷史。
11. EPV 兩筆 1,500 → 600，4,800 → 1,680；Sponsor 五代路由與固定代數一致。
12. 10/25 截止邊界、跨批次週結、固定付款及假日順延依核准日曆；K0 同窗口。
13. 四種登入連到同一會員；未驗證帳號或相同 email 不自動合併。

## 8 文件修訂及發布

依序完成有效文件清單、逐條衝突裁定、手冊／申請契約／系統需求／參數表同步，以及案例驗收。C3 合規文字與 R1.0B 經濟口徑逐條處理，不能宣稱整份新版 C3 已取代 R1.0B。

本次是規格更新，不改程式、資料庫、產品參數、付款／回收排程、正式會員權益或部署。R1.0B 封版原件與舊核准決議作為歷史基準保留；後續正式修訂使用新版本及明確 effectiveFrom。

## 9 來源

- governance/CURRENT_SSOT_POINTERS.md
- governance/sa-decisions/decisions.json (v3 原裁定，v4 增補本次決議)
- R1_0B_PRODUCT_OWNER_BOUNDARY_DECISIONS_20260917.md
- R1_0B_VOLUME_CLASS_CLARIFICATION_20260917.md
- R1_0B_FORMAL_MEMBERSHIP_DOCUMENT_PAPER_INTAKE_20261002.md
- R1_0B_FORMAL_MEMBERSHIP_PARTY_SPOUSE_CONTROL_20261002.md
- R1_0B_LEGAL_ENTITY_QUALIFICATION_IDENTITY_DOCUMENT_20261002.md
- R1_0B_WEB_MEMBER_MULTI_AUTH_DECISION_20261002.md
- Drive 核心邏輯規格：1hTm98mZIJX009zFoeZzjtExgjcqzpkv0；C3：1AZko_-ndJKGzuf-4sJSIaPkxx7Z0IryG；參加契約：10nRWa2Dxg6ReyuKKLAGcppILHXSlOBDr。
- 2026-10-01 核准 600 元入會與連續十二月未活躍決議，及 2026-10-03 本次補充建議核准。
