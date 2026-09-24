# UCell R1.0B 一般網路會員、資格啟用、紙本建檔與 LINE 補綁定規格 v1.0

狀態：APPROVED FOR IMPLEMENTATION
日期：2026-09-25
制度：R1.0B ONLY
關聯：LINE_OA_LOGIN_MINIAPP_INTEGRATION_SPEC.md、LINE_ACCOUNT_SECURITY_LITE_SPEC.md

## 1. 核准規則
- 加入 UCell LINE OA 好友是線上旅程必要第一步。
- 未取得正式資格者為一般網路會員，可登入、維護資料、原價購一般商品、查訂單，並可從三種現行 R1.0B 會員資格套組擇一購買。
- 資格套組付款/收款成立後不立即成正式會員；進入待推薦者安置。
- 推薦者依 R1.0B 完成該 Ball 的 authoritative Binary Placement 後，資格才 ACTIVE，成為正式會員。
- 接受紙本會員申請單與紙本訂購單，由授權人員在 Admin 建檔；紙本與線上匯入同一 R1.0B Qualification/Placement workflow。
- 紙本先建檔/先成正式會員者，日後加入 OA 並 LINE Login 時，可安全補綁既有 Person，不得另建 Person/memberNo/Ball。
- LINE OA friend、LINE identity、Person、Qualification 是不同概念。
- 一 Person 一 memberNo，可持有 0..N Balls；不建立 WebMember 與 Member 兩套主檔。
- 登入不等於會員價；價格由 authoritative customer/qualification context 決定。
- 本規格不得引用或硬編碼舊 PPU、舊階級、舊 Active 規則。

## 2. 狀態
以既有 Person + derived state 為主：
WEB_MEMBER：Person存在、0有效Qualification。
QUALIFICATION_PENDING：至少一筆已付款 acquisition 等待Placement。
QUALIFIED_MEMBER：至少一顆有效R1.0B Qualification。
SECURITY_LOCKED：沿用Security Lite，與資格狀態正交。

Qualification Acquisition lifecycle：
DRAFT/ORDERED → PAYMENT_PENDING → PAID → PLACEMENT_PENDING → ACTIVE。
例外：CANCELLED、REJECTED、REFUNDED。
安置前退款不得留下有效Ball；安置後退款走既有 Return → Replay → Adjustment/Recovery/Clawback。

## 3. 線上一般網路會員
1. 加入OA。
2. Rich Menu/官方入口啟動LINE Login。
3. Backend驗證LINE token。
4. subject已有ACTIVE binding則載入Person。
5. 新使用者完成一般網路註冊及自然人duplicate check。
6. 建立Person/memberNo與ACTIVE LINE binding。
7. Qualification可為0，UI顯示一般網路會員。
8. 一般商品使用原價/一般網路會員價格。
9. 三種資格套組由Backend Catalog回傳，不在前端硬編碼。
10. 選套組、確認Sponsor、建立訂單、付款。
11. authoritative payment confirmed → PLACEMENT_PENDING。
12. 推薦者出現待安置工作。
13. 推薦者或授權Admin呼叫既有Placement preflight/commit。
14. commit成功後建立/啟用Ball、ballNo、binaryPositionNo/path、Sponsor/Placement evidence。
15. acquisition ACTIVE；Person derived state QUALIFIED_MEMBER。

## 4. 商品與定價
Product/Catalog區分 RETAIL_PRODUCT 與 QUALIFICATION_PACKAGE（若既有等價型別則沿用）。
三種套組指向現行R1.0B qualification/plan definition，不在本規格寫死金額或舊階級。
WEB_MEMBER可買RETAIL_PRODUCT與三種active QUALIFICATION_PACKAGE，但不可進正式會員Organization/Earnings。
QUALIFIED_MEMBER依R1.0B authoritative context取得價格/PV/BV/資格。
禁止以 loggedIn=true 判斷會員價。

## 5. Sponsor與Placement
Sponsor與Binary Parent分離。
線上Sponsor使用正式identifier/search/invitation evidence，由Server驗證。
紙本由Admin依申請內容輸入/確認Sponsor並保存paper reference/operator evidence。
待安置工作顯示memberNo或核准最小identity、package、payment confirmed、Sponsor Ball、waiting time。
安置一律重用既有Tree/Parent/LEFT-RIGHT/Preflight/Commit。
Admin代安置時Sponsor不變，performedBy=Admin，reason/audit必填。


## 5A. 推薦碼 / Sponsor Code（正式規則）

推薦碼是 Sponsor Ball 的人類可讀入口，不另建立第二套 referral-code SSOT。

### 一般推薦碼
- Referral/Sponsor Code = Sponsor Ball.ballNo。
- ballNo 已是 unique、immutable、human-readable，因此不新增可漂移的 referralCode 欄位。
- 不使用 Person.memberNo 作推薦碼，因一個 Person 可持有多顆 Ball，推薦關係必須精確指向 Sponsor Ball。
- 不使用 UUID 作會員可見推薦碼。
- 推薦碼 resolver 必須 server-side 驗證 Ball 存在、有效、可作 Sponsor、使用者授權/制度資格與 R1.0B effective rules。

### 推薦入口
支援三種等價入口：
1. 手動輸入 ballNo，例如 A001286；
2. 推薦連結，例如 /join?ref=A001286（正式 domain/route 依環境設定）；
3. QR Code，內容只承載核准的推薦 deep link，不嵌入 PII 或內部 UUID。

LINE/OA/LIFF deep-link 流程必須保留 referral context 到 UCell onboarding，但不得讓 browser 直接建立 Sponsor relationship。

### Candidate → Evidence
- 使用者第一次由 referral link/code 進入時只建立 Sponsor Candidate/context。
- 在建立 Qualification Package Order 前，UI 顯示核准的推薦資訊讓使用者確認。
- Order/Qualification acquisition 建立時，Backend重新 resolve/validate referral code，並 snapshot 成 authoritative Sponsor Evidence。
- Sponsor Evidence 成立後，不得因後續 Binary Placement 改成 Binary Parent。
- 一般 RETAIL_PRODUCT 購物不因 ref 參數建立 Sponsor Relationship；推薦碼只在 Qualification acquisition 等 R1.0B 正式需要 Sponsor 的流程產生制度效果。

### 紙本
紙本會員申請單/訂購建檔可輸入相同推薦碼（Sponsor Ball.ballNo）。Admin輸入後必須經同一 SponsorResolver 解析、顯示核准最小推薦人資訊供核對，再建立 acquisition evidence；不得另做紙本 Sponsor 邏輯。

### Company Sponsor
創始/公司推薦等 R1.0B 核准情境不得要求 Member 使用或看到隱藏的 Bootstrap Company Ball #1–#3。
可使用受控 business alias（例如實際 alias 由設定決定，不在程式硬編碼），由 server-side Company Sponsor Policy 解析成 authoritative company sponsor evidence。
Member response 不得因此揭露 Bootstrap #1–#3 ballNo、Reservoir 或公司經濟資訊。

### 安全與一致性
- referral query/string 是 untrusted input；不得直接當 sponsorId。
- 不得透過推薦碼查詢任意 Ball holder PII。
- invalid/ineligible/expired（若未來政策有期限）推薦碼 fail closed，要求重新確認。
- 同一 acquisition 的 Sponsor Evidence 必須 idempotent。
- 推薦碼解析與 Sponsor eligibility 需保留 ruleVersion/effectiveAt/evidence。
- Ball ownership change 不改 ballNo，因此不改既有推薦碼 identity；是否仍可作新 Sponsor 由當期 R1.0B eligibility 判斷。

### 必測
- valid ballNo resolves to exact Sponsor Ball；
- memberNo 不可被當 Sponsor Code；
- UUID 不可作公開推薦碼；
- Person 多 Ball 時不同 ballNo 精確歸屬不同 Sponsor Ball；
- referral deep link/QR context survives LINE Login redirect；
- client tamper ref 在 order commit 時會被 server重新驗證；
- RETAIL_PRODUCT order 不建立 Sponsor relationship；
- Qualification order snapshot Sponsor Evidence；
- 紙本與線上使用同一 SponsorResolver；
- Company alias 不洩漏 Bootstrap #1–#3；
- BOLA/PII enumeration blocked；
- Sponsor Evidence 不被 Binary Parent 覆寫。


## 5B. 商品推薦獎金 Retail Referral Award（正式規則）

### 目的與邊界
新增獨立 Award Type：RETAIL_REFERRAL（商品推薦獎金）。
適用於一般網路會員 WEB_MEMBER 的一般商品 RETAIL_PRODUCT 消費推薦分潤。
RETAIL_REFERRAL 與 R1.0B Qualification Sponsor/Referral Award、Sponsor Tree、Binary Tree 完全分離；不得因零售推薦自動建立 Sponsor Relationship、Ball 或 Binary Placement。

### Retail Referrer Attribution
- 一般網路會員可具有 Retail Referrer Ball attribution。
- attribution 指向 Sponsor/Referrer Ball，以 ballNo 作人類可讀 referral code；內部仍用 immutable key/reference。
- referral link/code/QR 進入時先形成 Candidate；完成一般網路會員註冊/核准歸屬時，由 Server 重新 resolve/validate 後建立 attribution evidence。
- 第一版採穩定歸屬，不採 last-click 搶單：既有有效 Retail Referrer 不因之後點擊另一推薦連結自動改寫。
- Retail Referrer 的變更/解除必須走受控 policy、留下 reason/audit；不得由 query string 覆寫。
- 一般商品訂單建立時 snapshot 當時有效的 Retail Referrer Ball。
- Person 轉為 QUALIFIED_MEMBER 後，新的商品訂單預設不再套 WEB_MEMBER Retail Referral；改走 R1.0B 正式會員經濟規則，避免雙重計獎。若未來要讓正式會員也適用，需另立 Decision。

### SKU/Product 版本化參數
每一個 RETAIL_PRODUCT/SKU 的有效版本可設定：
- retailReferralEnabled: boolean
- retailReferralCalculationType: PERCENTAGE（v1先實作；FIXED_AMOUNT預留但不得未核准啟用）
- retailReferralRate: decimal，當 enabled=true 時必填，範圍由 validation policy 控制
- retailReferralBaseType: NET_PAID_ITEM_AMOUNT（v1正式基準）
- retailReferralRuleVersion/effectiveFrom/effectiveTo 或沿用既有商品版本化/effective dating
- 可選 eligibility metadata，優先沿用既有 Product/SKU parameter model

不得把全公司固定比例硬編碼在 Award Engine。商品營運人員可依授權調整未來有效版本；不得覆寫歷史版本。

### 計算基礎
v1 Retail Referral Base = 訂單行「商品實付淨額」：
- 以該 order line 實際商品金額為基礎；
- 排除運費、非商品費用；
- 訂單層折扣/優惠若分攤至商品行，使用分攤後 line net paid amount；
- 稅務含/未稅呈現依既有 Order money model，不另造第二套 rounding；Award base 必須使用同一 authoritative monetary snapshot；
- Award = base × snapshotted retailReferralRate，依既有 money/rounding policy。

若商品 disabled 或 rate=0，Award=0且不得建立非必要 payable award。


### 結帳時推薦碼補填、修正與鎖定
- WEB_MEMBER 若尚未存在有效 Retail Referrer Attribution，RETAIL_PRODUCT 結帳頁可「選填」商品推薦碼（ballNo）。
- referral deep link/QR 帶入的 code 只作 Candidate；在第一筆形成 attribution 的訂單 commit 前，使用者可修改或清除。
- 結帳按「驗證」時只做 server-side SponsorResolver/ReferrerResolver 驗證與安全顯示，不得建立永久 attribution。
- Order commit 時 Backend 必須再次 resolve/validate；成功後以該 code 建立 stable Retail Referrer Attribution，並 snapshot 到 Order Line。
- 沒有推薦碼仍可原價結帳：Retail Referrer = NONE，RETAIL_REFERRAL = 0。
- 一旦有效 Retail Referrer Attribution 已建立，後續商城結帳只顯示既有 referrer，不允許會員自行改成其他推薦碼；避免 last-click 搶單。
- 若需更正，走 Admin「Retail Referrer Correction」受控流程，需 reason、RBAC、audit、effectiveFrom；只影響更正生效後的新訂單，不回溯修改歷史 Order Snapshot/Award。
- QUALIFIED_MEMBER 不顯示 WEB_MEMBER 商品推薦碼輸入框；依 R1.0B 正式會員經濟規則。
- Qualification Package 的「會員推薦人/推薦碼」與 Retail Product 的「商品推薦碼」UI/語意必須分開；兩者可同用 ballNo，但不得共用 relationship state。

### 推薦者 Active Eligibility
RETAIL_REFERRAL 是否成立除 SKU 參數與 Retail Attribution 外，還必須檢查「受益推薦 Ball 在該筆交易的 authoritative eligibility time 是否符合 R1.0B Active 規則」。

正式原則：
- 不在本規格硬編碼 Active 算法；必須呼叫現有 R1.0B Active/Eligibility authoritative service/evidence。
- Award recognition 時 snapshot：referrerBallId/ballNo、activeEligible boolean、activeRuleVersion、activeAsOf/evidence reference。
- 只有 retailReferralEnabled=true、有效 attribution、且 referrer Ball activeEligible=true 時，才建立 payable RETAIL_REFERRAL。
- 推薦者不活躍時：該筆訂單的 Retail Referral = 0 / INELIGIBLE（依既有Award模型採最小一致表示），不得暫存在待領池、不得日後恢復活躍後追補，除非未來另立正式Decision。
- Active判斷使用該筆Award recognition/economic event的正式as-of，不使用目前最新狀態回算歷史。
- 後續推薦者失去Active，不追回先前在當時合格且已成立的Retail Referral；商品退貨仍依Return/Replay處理。
- 若交易當時不活躍，後來恢復Active，不得改寫該歷史訂單為可領。
- Admin/Explain應能說明「商品可推薦 + 推薦歸屬有效，但推薦Ball於認列時不符合Active，因此本筆商品推薦獎金不成立」，不得洩漏不必要PII。
- Retail Referrer Attribution本身不因推薦者暫時Inactive而刪除；後續每筆新訂單重新按各自recognition as-of檢查Active。

新增必測：
- 無既有attribution時checkout可補填/修改/清除推薦碼；
- 首筆commit後attribution鎖定，後續checkout不可自行換碼；
- 無推薦碼可正常原價結帳且無Retail Referral；
- Admin更正只影響effectiveFrom後新訂單；
- Qualification Sponsor code與Retail Referral code relationship不混用；
- referrer active + enabled SKU → payable RETAIL_REFERRAL；
- referrer inactive at recognition → no payable award；
- inactive後恢復不追補舊單；
- active後失效不追回先前合法award（Return除外）；
- historical replay使用snapshotted active rule/as-of evidence；
- Active eligibility check不改既有R1.0B Active演算法與Golden。

### Order Line Snapshot
Retail order 成立/recognition 時必須 snapshot，不可結算時回讀商品目前最新值：
- retailReferralEnabled
- retailReferralCalculationType
- retailReferralRate
- retailReferralBaseType
- retailReferralRuleVersion/productVersion
- retailReferrerBallId
- retailReferrerBallNo（display/evidence snapshot）
- attribution/evidence reference
- base amount inputs

商品日後由10%改5%，既有訂單仍依下單/recognition時的10% snapshot。Replay也使用歷史snapshot/effective evidence。

### Award / Ledger / Settlement
- Award Type = RETAIL_REFERRAL。
- beneficiary = snapshotted Retail Referrer Ball。
- source = retail order line / recognition evidence。
- append-only ledger/evidence、idempotency、settlement/payout沿用既有框架。
- 不產生 Sponsor Tree edge，不產生 Binary volume/award，除非R1.0B其他正式規則本身另有明文；本Award不得自行注入GPV/RPV/EPV/PV/BV。
- WEB_MEMBER本身無Ball時，其消費不得被錯誤塞入Retail Referrer Ball作組織業績。

### Return / Refund
- Return尚未POSTED：不改既有Award事實。
- Return POSTED：依退回order line比例/金額重算該Retail Referral effect。
- 未支付部分以adjustment抵銷；已支付部分進既有Recovery機制。
- 使用既有 Return → Replay → Adjustment/Recovery 架構，不另做可變更歷史Award的捷徑。
- 部分退貨、數量退貨、折讓必須有deterministic proportional/line-level evidence，沿用既有money rounding。

### Admin 商品設定 UX
商品/SKU版本頁新增「商品推薦獎金」區：
- 啟用商品推薦獎金
- 計算方式：百分比（v1）
- 推薦獎金比例
- 計算基礎：商品實付淨額
- 生效時間/版本
- 變更預覽與Audit

權限依既有Product/Economic Parameter RBAC；已生效歷史版本不得直接覆寫。

### Member / Admin UX
WEB_MEMBER購物頁可在需要時顯示「由推薦人推薦」等低敏感資訊，但不得揭露不必要holder PII。
推薦Ball持有人在收益/ledger中看到 RETAIL_REFERRAL，顯示來源商品/訂單的最小必要evidence，不揭露消費者不必要PII。
Admin/Finance可依RBAC查Retail Referral attribution、Award、Return/Recovery與商品參數版本。

### Company / Hidden Bootstrap
Retail Referral不得透過Member UI暴露Tree Position 1–3 Bootstrap Company Balls。若未來Company alias可作Retail Referrer，必須另由Company policy解析並遵守Member zero-disclosure；本v1不得自行推定。

### 必測
- WEB_MEMBER + valid Retail Referrer + enabled SKU → 正確RETAIL_REFERRAL。
- enabled=false/rate=0 → no payable award。
- 不同SKU可有不同rate。
- 商品版本10%→5%，歷史order保持10%。
- order discount正確分攤到line base；shipping不進base。
- referrer snapshot後query string不能改寫既有order。
- Retail Referral不建立Sponsor Tree/Binary edge。
- WEB_MEMBER消費不注入referrer Ball組織業績。
- QUALIFIED_MEMBER新訂單不套WEB_MEMBER Retail Referral，避免double award。
- partial/full return POSTED deterministic adjustment/recovery。
- replay使用歷史snapshot。
- beneficiary/referrer BOLA/PII安全。
- concurrent/idempotent order recognition不重複發Award。
- R1.0B既有Economic Golden結果不變（新增fixture除外）。

## 6. 紙本申請/訂購 Admin Wizard
Step1 搜尋既有Person：memberNo及核准PII/自然人唯一查核，先防duplicate。
Step2 無既有Person才建立，source=PAPER_APPLICATION，產生/沿用memberNo。
Step3 紙本資料：paperApplicationNo、receivedAt、operator、document/evidence reference、必要資料；證件內容不得進一般log。
Step4 紙本訂單：source=ADMIN_PAPER_ORDER，選R1.0B資格套組或一般商品。
Step5 收款evidence：只有授權角色可確認，idempotent。
Step6 確認authoritative Sponsor。
Step7 payment confirmed → PLACEMENT_PENDING。
Step8 推薦者線上安置或授權Admin代安置。
Step9 commit成功 → ACTIVE/QUALIFIED_MEMBER。
紙本與線上不得有兩套Bonus/Placement logic。

## 7. 紙本會員日後 LINE 正式補綁定
情境：紙本已建立Person/memberNo，可能已完成Qualification/Placement，但尚無ACTIVE LINE binding。
1. 會員加入OA。
2. 由Rich Menu進「綁定既有會員」。
3. LINE Login，Backend取得verified subject。
4. 不得只靠memberNo綁定。
5. 使用者提出 Existing Member Link Request，輸入memberNo與公司核准的驗證資訊。
6. 第一版採後台核准邀請：
   - Support以memberNo找Person並核對紙本/聯絡資料；
   - 記verification reference；
   - Manager/授權角色核准，申請者不得自核；
   - 系統產生短效一次性link token，只存hash、不log明文；
   - 會員在verified LINE session完成token exchange；
   - transaction檢查subject未綁他人、Person無其他ACTIVE binding、request approved/unexpired；
   - 建立ACTIVE LINE binding、revoke衝突session、request COMPLETED、audit。
7. Person已有ACTIVE LINE binding時不得覆蓋，轉LINE_ACCOUNT_SECURITY_LITE rebind/recovery。
8. Person/自然人資料衝突時FAIL CLOSED人工review，不新建第二Person。
9. 成功後直接看到既有memberNo/Balls；不得建立新Ball。
10. 補綁不改Sponsor、Position、ballNo、業績、獎金。

## 8. 新會員/既有會員分流
verified subject無binding時提供：
- 我是既有會員 → Existing Member Link Request。
- 我是新會員 → Web Member Registration。
建立新Person前必須duplicate check；疑似已有紙本Person時禁止新建並導向客服/既有會員綁定。

## 9. 自然人唯一性
LINE subject不是自然人唯一鍵。
依公司核准欄位建立normalized identity fingerprint/hash；敏感原值encrypted-at-rest，hash做duplicate detection；完整證件不得進log/OpenAPI example。
若唯一欄位尚未法遵/營運核准，本輪建立interface並fail closed，不自行猜測Production規則。

## 10. Admin UX
Person360：memberNo、derived membership state、LINE binding、Qualifications/Balls、pending acquisitions、paper refs、security、audit。
新增：
- Paper Application Intake
- Existing Member LINE Link Requests
- Pending Placement Queue
- Payment/Receipt Evidence Review（RBAC）
正常UI不以UUID為主要識別。

## 11. Member UX
WEB_MEMBER：一般網路會員標示、商城原價、三種會員方案、訂單、我的、加入正式會員CTA；Organization/Earnings不可用。
PLACEMENT_PENDING：顯示「資格套組已完成，等待推薦者安置」。
QUALIFIED_MEMBER：Experience v2正式會員功能，依selected Ball。

## 12. OA/Rich Menu
OA好友為線上journey prerequisite。
一般/未綁定入口：我的UCell、會員方案、商城、訂單、綁定既有會員/加入正式會員、客服。
正式會員：我的UCell、我的組織、我的收益、會員商城、訂單查詢、客服。
若per-user Rich Menu第一版成本高，可共用Menu，進UCell後依狀態導流。

## 13. API/Commands（依既有convention調整）
- register web member
- list qualification packages
- create/read qualification acquisition
- list sponsored pending placements
- placement preflight/commit（重用既有）
- admin paper application/order intake
- admin confirm qualification payment
- admin pending placement read
- create existing-member LINE link request
- approve/reject LINE link request
- complete existing-member LINE link
優先重用Order/Payment/Placement/ExternalIdentity services。

## 14. Idempotency/Concurrency
所有command使用既有Idempotency-Key或等價機制。
payment confirmation不可重複acquisition；Placement concurrency-safe；link token single-use；concurrent linking只能一個成功；duplicate Person fail closed。

## 15. Audit/Notification
Audit至少：WEB_MEMBER_REGISTERED、PAPER_APPLICATION_CREATED、PAPER_ORDER_CREATED、QUALIFICATION_PACKAGE_ORDERED、QUALIFICATION_PAYMENT_CONFIRMED、QUALIFICATION_PLACEMENT_PENDING、QUALIFICATION_PLACED、QUALIFICATION_ACTIVATED、EXISTING_MEMBER_LINE_LINK_REQUESTED/APPROVED/REJECTED、LINE_BINDING_CREATED、ADMIN_PLACEMENT_ON_BEHALF。
不記token明文/完整證件/銀行資料。
通知：付款後通知本人等待安置；通知Sponsor待安置；安置完成通知正式會員啟用；紙本會員補綁成功通知；久未安置營運提醒。Provider未配置時CONFIGURATION_PENDING，不rollback交易。

## 16. Privacy/P0
保持Reservoir Member zero-disclosure、Tree bootstrap Position1-3 hidden、非直推holder PII hidden、UUID非一般UI label。Paper operator不得因建檔取得Sponsor或經濟權益。

## 17. 必測
1. 新LINE使用者可成WEB_MEMBER且0 Qualification。
2. WEB_MEMBER原價購物，不得取得正式會員價/Organization/Earnings。
3. Catalog只回三種active R1.0B qualification packages。
4. 未付款不進PLACEMENT_PENDING。
5. payment confirmed idempotent。
6. pending placement尚非正式會員。
7. Sponsor authoritative placement後才ACTIVE。
8. placement race fail-safe。
9. Admin代安置不改Sponsor。
10. 紙本Person+order+payment+placement成功。
11. 紙本先查重。
12. 紙本會員日後LINE Existing Member Link成功。
13. 只知道memberNo不能綁定。
14. approved one-time token才可綁；expired/replay/tamper denied。
15. 已有ACTIVE binding轉Security Lite，不覆蓋。
16. 補綁後memberNo/Balls/ballNo/Sponsor/Position/economics不變。
17. duplicate疑似fail closed。
18. 安置前退款無active qualification；安置後退款走Return/Replay。
19. BOLA/IDOR。
20. R1.0B Economic Golden unchanged。

## 18. Migration/OpenAPI/Gates
forward-only migration；先audit既有schema/service後最小新增。
OpenAPI regenerate/validate/diff。
跑Backend/Admin/Member/Shared full regression、Decision v3/R1.0B Golden、DB Golden、Return/Replay、Settlement/Payout、P0 privacy、LINE security。
不部署Stage/Production，除非另行明確授權。

## 19. Deliverables
- R1_0B_MEMBER_ONBOARDING_IMPLEMENTATION_REPORT.md
- R1_0B_MEMBER_ONBOARDING_PASS_FAIL_MATRIX.md
- R1_0B_MEMBER_ONBOARDING_UAT_CHECKLIST.md
- 更新 IMPLEMENTATION_STATUS.md、Data Dictionary、OpenAPI artifacts。
