# 商品評價與附件審核 — 2026-10-23

已上線至會員商城與管理後台。開發目錄為 `D:/UCell/review-work/source`，避開已滿的 C 槽；原 C 槽工作目錄未修改。

## 操作流程

- 會員：我的 → 訂單 → 已收貨訂單明細 → 每項商品的商品評價。
- 1–5 星、選填 1,000 字心得、最多 6 個附件；其中最多 1 個影片或音訊。
- 照片 JPG/PNG/WebP 每張 5 MiB；影片 MP4/WebM、音訊 MP3/M4A 每個 20 MiB。
- 分段上傳顯示進度、成功與失敗重試；送審前須同意公開。未完整上傳不能送審。
- 後台：商務 → 商品評價審核。ORDER_OPS / SUPER_ADMIN 可核准、退回、下架；COMPLIANCE_AUDIT 唯讀。
- 退回與下架必填原因。退回可修改重送，版本檢查防止誤審舊內容。
- 商品卡的「商品評價」顯示核准內容、平均星等、星等篩選、分頁及附件檢視。公開身份固定為「已驗證購買會員」，不透露姓名、會員號或訂單號。
- 舊版訂單心得保留且不自動公開；新評價逐商品計算前後台訂單的待評價數量。

## 實作與發布

新增 migration `20261023120000_product_review_media`。附件使用既有私人 Azure Blob 容器，獨立 `product-reviews/` 前綴；公開存取每次驗證 APPROVED 狀態，回應 no-store，影音支援單一 Range 請求。格式檢查為容器檢查，不宣稱病毒或內容辨識。

API 採固定舊映像的增量覆蓋，僅新增評價檔案、修補 live MemberModule 註冊及兩個訂單追蹤 service，保留既有正式機其他修補。啟動先執行 checksum 保護、交易式 migration，成功後才啟動 API。

正式映像：

- API `sha256:f596c3fa83a237da310da20c0846233242aee2254d58243cb98dfc9d5ebc8f16`
- Member `sha256:d9333095b23c5b1d1e145d7f6aee9997b2c2e58dc9428cc59880dfcd102e2e88`
- Admin `sha256:5f5c7c06906a115e5e123d923f9459c3035c8af3f2537435e0689486dc70c6ba`

三個 app 的 latest 與 ready revision 一致，最新版本流量 100%。會員與管理後台正式網域實際 HTML 已確認引用新 bundle。

## 驗證

- API Nest build、會員 TypeScript、後台 app TypeScript、前後台 production build 通過；LINE LIFF 與 Entra 正式登入設定檢查通過。
- `unit.cjs`：上傳大小邊界、嚴格 Base64、偽造格式拒絕、MP4 容器及 Range 206/416 與 no-store。
- `browser-qa.cjs`：使用 fixture API 的 Edge 手機／桌面操作測試；2 星、心得、照片分段上傳、同意公開、送審、後台確認核准、商品公開內容、照片放大。無 pageerror、無水平溢出。截圖位於 `D:/UCell/review-work/qa`。
- Jest `order-hub.e2e-spec.ts`：3 tests passed，含訂單完整歷史計數、已評商品移除待評價數、權限及未收貨阻擋。
- 正式容器 `verify-rollback.cjs`：真實 PostgreSQL 交易內建立測試訂單與已送達配送，測試所有權、未送達阻擋、附件重試、私人權限、送審、退回、重新送審、版本衝突、核准公開、2 星保留、下架撤除、前後台 COMPLETED 統一。附件儲存使用測試替身；全部測試 DB 資料回滾，無付款事件。
- 另以正式 managed identity 驗證私人 Blob 寫入／讀回；隨機 QA key 當場刪除，未觸碰既有附件。
- 正式 HTTP：五項主商品評價接口 200；不存在／未公開附件 404；未登入會員及後台接口 401。

尚未使用真實會員帳號發佈公開測試評價，未代替會員產生評價。實際會員內容將依正常送審流程公開。
