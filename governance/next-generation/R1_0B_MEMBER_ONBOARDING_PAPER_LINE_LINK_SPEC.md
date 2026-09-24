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
