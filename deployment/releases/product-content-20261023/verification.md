# 商品說明、富文字上稿與精選評價 — 2026-10-23

已部署 API、會員前台、管理後台，各 app 的 latest 與 ready revision 均為 `product-content-20261023`，100% 流量。

## 使用流程與設計

- 商城主商品卡的圖片、名稱、規格及說明入口連至 `/shop/products/:sku`。卡片僅查詢 APPROVED + featured 評價，最多展示兩則精選摘要；沒有精選時不顯示評價區塊。
- 商品頁呈現圖片／相簿、價格、數量、購物車入口、分享、商品說明及所有核准評價。手機有固定購買列；圖文／評價錨點不與主要導覽重疊。
- 商品清單與說明頁共用 sessionStorage 購物車（依資格區分）；進出說明頁保留數量，加入時累加並限制每項 99 件。實際下單仍經原伺服器價格及資格檢核。
- 後台「商務 → 商品說明上稿」可選商品，新增段落、標題、清單、粗體、斜體、底線、HTTPS 連結；可上傳照片、影片、音訊與加入 YouTube 影片，調整區塊順序、預覽、儲存草稿、發布／取消發布。
- `.rtf` 匯入支援文字、段落、基本粗體／斜體／底線、Unicode 與 Big5。1 MiB、最多 100 區塊與 50,000 字；不保證 Word 複雜版面與表格還原，內嵌圖片／物件會提示另行上傳。貼上內容以文字插入，避免夾帶任意 HTML。
- 上傳照片 JPG/PNG/WebP 每張 5 MiB，影片 MP4/WebM、音訊 MP3/M4A 每個 20 MiB；256 KiB 分段、進度、失敗重試。失敗附件需重試或放棄才能發布。
- 後台已公開評價可勾選「設為精選」，取消精選仍保留於商品頁所有核准評價；下架自動取消精選。
- 新上稿內容尚未發布時，商品說明區提供既有官網商品資料連結；未虛構、代寫或自動發布商品功效文案。五項商品在本次發布時尚無新說明內容。

版面參考 Shopify 將商品資訊、富文字說明、圖片及影片集中於商品頁的做法：[商品詳細資料](https://help.shopify.com/en/manual/products/details/product-details-page/)、[富文字編輯器](https://help.shopify.com/en/manual/shopify-admin/productivity-tools/rich-text-editor)。

## 資料與權限

新增 migration `20261023140000_product_content_featured`。後台內容管理權限為 SUPER_ADMIN / ORDER_OPS，COMPLIANCE_AUDIT 唯讀。文件以驗證後的 JSON 區塊保存、React 渲染，沒有使用任意上稿 HTML；連結限制 HTTPS，YouTube 限定影片 ID。草稿／發布內容分離、儲存版本衝突檢查、發布操作留存 audit。

附件使用私人 Azure Blob `product-content/` 前綴。公開媒體每次檢查是否屬於有效商品的已發布文件；草稿附件不公開。重用既有格式驗證與 Range 播放，no-store，不宣稱病毒掃描或內容辨識。

## 驗證證據

- Nest build、會員 TypeScript、後台 app TypeScript、正式前端 build 通過；LINE LIFF / Entra production login configuration 檢查通過。
- `rtf-import.test.ts`：4 tests passed（Unicode／基本格式、Big5、內嵌物件與欄位忽略、錯誤／大小檢查）。
- `unit.cjs`：區塊與文字上限、非 HTTPS／不支援區塊拒絕、任意屬性剔除、媒體 ID 檢查。
- `browser-qa.cjs`：Edge fixture API，手機及桌面；富文字編輯、RTF 匯入、真實商品圖片跨多段上傳、預覽、草稿不公開、發布、精選勾選、主商品卡僅精選、詳情頁所有核准評價、購物車 1 + 2 = 3、手機無水平溢出、無 pageerror。截圖 `D:/UCell/review-work/content-qa/`。
- 正式容器 `content-verify.cjs`：真實 PostgreSQL 交易中建立獨立測試商品、訂單、評價，驗證草稿／發布／取消發布、版本衝突、重試冪等、上傳者權限、附件私有、精選僅限核准、2 星核准評價可精選、取消精選不刪除核准評價、下架移除精選。所有 DB 測試資料回滾，storage 使用測試替身。
- 正式 HTTP：五項商品說明與精選評價接口 200；未登入後台上稿接口 401；不存在媒體 404。
- 正式深連結 HTML 與 bundle 比對：會員 `/assets/index-CgjRh9gX.js`，後台 `/assets/index-DVMdsha7.js`。

## 正式映像

- API `sha256:10471c758e2d0ed7426605a6542f2ac5ad548243c964ba838a18981d9412c0d0`
- Member `sha256:6075964b438517ebd5ad03daa38ee1d657b9eaf77476503a3fec31c0f1b9239b`
- Admin `sha256:875e15cc02587e03e11c1faf89ba758b33dac109c9e204020883fa3b8b5db132`

API 使用上一版正式映像增量覆蓋及 live MemberModule 精準註冊，不覆蓋其他歷史正式機修補。migration 於 API 啟動前執行且有 checksum／交易保護。原始碼工作目錄 `D:/UCell/review-work/source`。
