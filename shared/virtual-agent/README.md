# UCell 智慧秘書 — 固定形象 v1

2026-10-22 使用者指定最後一版短髮、正面凝視、熱心真誠服務感的成年女性為線上虛擬客服。名稱採「UCell 智慧秘書」，不自行替人物新增姓名或真人背景。

## 定裝規範

- 固定臉孔、俐落短髮、自然微笑與正面目光；米白 Polo、香檳金滾邊、UCell 胸前刺繡。
- 形象始終標示「AI 虛擬助理」，不宣稱真人在線或已受理人工案件。
- `originals/approved.png` 為使用者定裝參照；`originals/portrait.png`、`originals/welcome.png` 為以此參照生成的獨立素材。以內建 imagegen 生成。
- `portrait.webp` 為對話頁人物，`welcome.webp` 為迎賓／服務引導，`avatar.webp` 為回覆、載入狀態及服務入口。WebP 僅作尺寸與編碼最佳化。
- 新姿態必須以定裝參照圖編輯，保留人物身分、髮型及制服；避免每頁重新生成不同臉孔。

## 使用範圍

- 官網：全站可收合服務入口、聯絡我們與 FAQ 迎賓區。提供服務導引，不建立匿名個資查詢或假聊天。
- 會員：首頁服務卡、AI 問答人像、回答與查詢中頭像，保留本人資料權限。
- 後台：有權使用 AI 的管理員顯示頂部入口；AI 頁使用同一角色與來源證據。
- 桌面顯示人物卡，手機縮為頭像。保留資料來源、範圍、錯誤、停止查詢、回饋及報表功能。

## 素材更新

共同素材以本目錄為來源，發布時同步至 website/assets/virtual-agent、admin/public/assets/virtual-agent、member/public/assets/virtual-agent。三端檔案必須具有相同 SHA-256。角色變更須另建版本並經使用者確認。

## 生成提示詞

Portrait: Re-create the EXACT SAME adult short-haired female secretary from approved UI reference, identical face, front-facing upright head, kind attentive eyes, sincere welcoming smile, ivory gold-trim UCell polo, subtle gold studs, natural skin, premium corporate photography. Waist-up, relaxed arms, deep petrol studio background, portrait 3:4. No UI or extra text.

Welcome: Preserve EXACT SAME portrait identity, face, professional short haircut, uniform and photography. Waist-up, frontal direct eye contact, warm smile, one hand gently palm-up in a professional service guidance gesture, other hand relaxed at waist. Anatomically accurate hands, deep petrol studio background, portrait 3:4. No UI or extra text.

## 驗證

`node deployment/virtual-agent-browser.cjs` 使用隔離的合成回答驗證共用 AI 元件與官網客服入口，產生桌面與手機截圖，不呼叫正式會員資料或模型。另執行三個前端既有測試與正式組建。
