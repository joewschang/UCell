# UCell LINE 帳號安全處置機制 Lite — 系統規格 v1.0

**狀態：** APPROVED FOR IMPLEMENTATION  
**日期：** 2026-09-24  
**適用範圍：** Member Identity / Admin Person 360 / Payout Account Change  
**設計原則：** 小幅異動、高安全、人工審核、完整稽核；不重構 Person/Ball/Bonus/Tree/Settlement 核心。

## 1. 目標與非目標

本規格處理會員 LINE 帳號遭盜、遺失或需更換登入 LINE 身分時的安全處置。LINE 僅為外部登入身分；Person、memberNo、Ball、ballNo、Sponsor、Binary Position、組織、業績、獎金與歷史資料均不得因 LINE 重綁而改變。

本版不導入 Risk Engine、Passkey/WebAuthn、Device Trust、完整 MFA 平台或自動 KYC。銀行/匯款帳戶不得由會員前台自行修改。

## 2. 核心流程

1. 會員以公司正式管道通報 LINE 疑似被盜，提供 memberNo 與公司 SOP 要求之身分資料。
2. Support 在 Person 360 執行「安全鎖定」。
3. 系統將 Person.securityStatus 設為 SECURITY_LOCKED、撤銷全部 Member Sessions，並使現有 LINE binding 不再可用於登入。
4. Support 建立 LINE_REBIND recovery request，記錄原因與人工身分核驗結果/附件引用。
5. Manager 以上授權角色審核；申請者不得自行核准。
6. 核准後產生一次性、短效、不可重放的 rebind token/link；token 僅保存雜湊，不保存明文。
7. 會員以新 LINE 完成 LINE Login/LIFF；Backend 驗證新 LINE subject 與 token 後，以單一交易 revoke 舊 binding、建立/啟用新 binding。
8. 重綁成功後撤銷舊/現存 sessions，再解除 SECURITY_LOCKED；記錄 Audit。
9. 重新綁定後 24 小時內禁止再次 LINE rebind，除非由更高權限人工 override 並留下理由與 audit。
10. memberNo、所有 Ball、組織與經濟計算全程不變。

## 3. 安全鎖定語意

Person 增加或擴充：
- securityStatus: NORMAL | SECURITY_LOCKED
- securityLockedAt: timestamptz nullable
- securityLockedReason: text nullable

SECURITY_LOCKED 時：
- 所有既有 Member session 立即失效；
- LINE member authentication fail closed；
- 禁止會員敏感帳戶操作；
- 不停止 GPV/RPV/EPV、Active 判定、Carry、Award、Settlement 等 Core 計算；
- Admin 依 RBAC 仍可查閱與處理 recovery。

解除鎖定只能在核准流程完成且新 binding 成功後，或由具備明確 override 權限的主管執行並留下理由。

## 4. LINE Binding

沿用既有 External Identity / LINE Binding 模型；不足時增加：
- status: ACTIVE | REVOKED
- revokedAt
- replacedByBindingId nullable
- revokeReason
- boundAt / verifiedAt（若既有則沿用）

約束：
- 同一 Person 同一時間最多一個 ACTIVE LINE binding；
- 同一 LINE subject 不得同時 ACTIVE 綁定多個 Person；
- revoke 不 delete；
- 重綁不得修改 Person/memberNo/Ball/ballNo；
- 任何 security-locked Person 的舊 binding 不得通過 Member authentication。

## 5. Recovery Request

新增最小資料結構 AccountRecoveryRequest：
- requestId UUID PK
- requestNo human-readable unique，例如 REC-20260924-000001
- personId UUID FK
- type: LINE_REBIND | BANK_ACCOUNT_CHANGE
- status: PENDING | APPROVED | COMPLETED | REJECTED | CANCELLED
- reason text
- identityVerificationNote text / evidence reference（不得把敏感證件內容直接寫入一般 log）
- requestedBy
- approvedBy nullable
- completedBy nullable/system
- requestedAt / approvedAt / completedAt
- rejectionReason nullable
- rebindTokenHash nullable
- rebindTokenExpiresAt nullable
- rebindTokenUsedAt nullable

規則：
- requestedBy != approvedBy；
- LINE_REBIND 僅 APPROVED 可產生一次性 token；
- token 建議 30 分鐘有效；
- token 單次使用、使用後立即失效；
- token 明文不得寫 DB/log/analytics；
- request status transition 由 server 驗證，禁止任意跳狀態。

## 6. 匯款/銀行帳戶異動

會員前台：
- 僅顯示遮罩資訊，例如銀行名稱 + ****5678；
- 不提供新增/修改/刪除收款帳戶功能。

異動流程：
1. 會員提交公司指定書面申請及證明文件；
2. Support/Finance 建立 BANK_ACCOUNT_CHANGE request；
3. 主管/Finance 審核；
4. 授權 Admin 於後台輸入新資料；
5. 系統保存變更前/後遮罩摘要、操作者、核准者、時間與 requestNo；
6. 完成後通知會員。

銀行資料沿用既有加密機制；不得在 audit/log 保存完整帳號。若現有系統尚無安全 encrypted-at-rest 欄位，實作前 fail closed，不得以 plaintext 暫代。

## 7. Admin UX — Person 360 / 帳號安全

新增「帳號安全」區塊：
- 安全狀態 NORMAL / SECURITY_LOCKED
- LINE binding 狀態與最後綁定時間
- 安全鎖定 / 撤銷所有 Member Sessions
- 建立 LINE 重新綁定申請
- 主管審核
- 產生一次性 rebind link（只在核准後）
- 解除安全鎖定
- 安全異動歷史

所有按鈕依 RBAC；危險操作需 confirmation + reason。

## 8. 最小 RBAC

- Support：鎖定、撤銷 sessions、建立 recovery request；不得核准自己的 request；不得直接完成銀行帳戶異動。
- Manager/Super Admin：核准/拒絕 LINE_REBIND；必要時有 audited override。
- Finance：審核 BANK_ACCOUNT_CHANGE。
- Authorized Finance/Admin：核准後套用銀行帳戶變更。
- Member：不可自行解除鎖定、不可自行換銀行帳戶。

若現有角色名稱不同，映射到既有 RBAC，不為本功能另造大型角色系統。

## 9. API（可依現有 REST 命名調整）

- POST /api/v1/admin/persons/{person}/security-lock
- POST /api/v1/admin/persons/{person}/security-unlock
- POST /api/v1/admin/persons/{person}/sessions/revoke
- POST /api/v1/admin/account-recovery
- POST /api/v1/admin/account-recovery/{id}/approve
- POST /api/v1/admin/account-recovery/{id}/reject
- POST /api/v1/admin/account-recovery/{id}/rebind-token
- POST /api/v1/member/auth/line-rebind/complete
- POST /api/v1/admin/account-recovery/{id}/bank-account/apply

優先使用 memberNo/requestNo 作營運 UI 搜尋與顯示；UUID 可作內部 route key，不作一般 UI label。

## 10. Session Revocation

安全鎖定與 LINE rebind 完成時均必須撤銷所有 Member sessions。下一個 API request 必須 fail closed，不得等 token 自然過期。Admin sessions 不受 Member lock 影響，但仍依 RBAC。

## 11. Audit

Append-only audit 至少記：
- SECURITY_LOCK
- MEMBER_SESSIONS_REVOKED
- LINE_REBIND_REQUESTED
- LINE_REBIND_APPROVED / REJECTED
- LINE_BINDING_REVOKED
- LINE_BINDING_CREATED
- SECURITY_UNLOCK
- BANK_CHANGE_REQUESTED / APPROVED / APPLIED / REJECTED

記錄 actor、personId、memberNo snapshot、requestNo、timestamp、reason、correlationId；不得記完整銀行帳號、token 明文、LINE access/id token。

## 12. 通知

第一版沿用現有可用通知管道；若 Email/LINE 通知尚未配置，建立 notification event/outbox，不阻塞安全交易。至少在 LINE rebind 完成與銀行帳戶異動完成時產生通知事件。舊 LINE 若已撤銷/被盜，不應作唯一通知管道。

## 13. 24 小時重綁冷卻

成功 LINE rebind 後 24 小時內，新的 LINE_REBIND request 預設拒絕。Manager/Super Admin override 必須輸入理由並 Audit。此冷卻不影響正常登入與會員經濟權益。

## 14. 不可破壞的既有規則

本功能不得改變：
- Person/memberNo identity；
- Ball/ballNo/binaryPositionNo；
- Sponsor/Binary topology；
- GPV/RPV/EPV、Active、Carry、Awards；
- Settlement/Payout 計算結果；
- Member 對 Reservoir zero-disclosure；
- Member Tree bootstrap #1–#3 隱藏與 PII 規則。

## 15. 必測案例

1. security lock 後既有 Member session 下一 request 失效。
2. security lock 不影響 Core economic Golden。
3. revoked LINE 無法登入。
4. Support 可建立但不能核准自己的 LINE_REBIND。
5. 未核准 request 無法取得 rebind token。
6. token 過期/重放/竄改均失敗。
7. 新 LINE subject 已綁他人時 fail closed。
8. rebind 成功後舊 binding REVOKED、新 binding ACTIVE、sessions 全撤銷、Person/Balls 不變。
9. 24h 內再次 rebind 預設拒絕；authorized override 有 audit。
10. Member 前台無銀行帳戶修改能力。
11. 未核准 BANK_ACCOUNT_CHANGE 無法 apply。
12. audit/log 不含完整銀行帳號、token、LINE token。
13. BOLA/IDOR：不可操作其他 Person/request。
14. concurrent rebind 只能一個成功。
15. Return/Replay/Settlement/Bonus regression 全 PASS。

## 16. Migration / OpenAPI / Release

- forward-only migration；不得改歷史 migration；
- OpenAPI regenerate/validate/diff；
- 新 Admin/Member contract 加 RBAC/BOLA tests；
- 不建立 Stage/Production auth bypass；
- 本功能先 local/isolated PASS，再由 Product Owner 決定 Stage deployment；
- Production 維持 BLOCKED，直到既有 release gates 完成。

## 17. 驗收標準

完成定義：
- Schema/API/Admin UX/Member auth guard 實作；
- 全部 focused security tests PASS；
- full regression / Economic Golden PASS；
- OpenAPI PASS；
- working tree clean、local=origin；
- 產出 implementation report 與 PASS/FAIL matrix；
- 無 Stage/Production mutation，除非另行明確授權。
