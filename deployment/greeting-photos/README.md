# 每日關懷：實景攝影背景

## 變更範圍

- 10 張實景照片，六類主題交錯：花卉、湖山、森林、瀑布、海岸、日出。以日期決定選圖，10 天內不重複同一張；這是可擴充的精選圖庫，不是每天新拍或 AI 生成的照片。
- 每張來源皆由 Wikimedia Commons 個別檔案頁明示 **CC0**。逐張來源頁、原始下載 URL、作者、原始尺寸、來源與入庫 SHA-256、檢視日期列在 `backend/apps/api/src/modules/daily-greetings/assets/photos/catalog.json`。原始來源 metadata 保留在 `evidence/source-metadata.json`。未取得人物肖像或商標授權，因此本批不使用可辨識人物、商品或商標作為主體；不得推論其他 Commons 照片也具有同樣授權。
- 原圖最長邊縮至 2560 px，不放大。正確套用 EXIF 方向、移除 metadata；保留高解析實景攝影，輸出仍為相容現有分享與資料庫的 **1080 × 1080 PNG**。花卉、樹木照片細節較多，本批每張輸出均需通過現有 3 MB 儲存上限的測試。
- 照片滿版，正式 Logo 保留完整 16:9 比例，繁體文字置於不透明度 95% 的淺色面板。保留週末、節慶與日安文案；氣象關懷明示情境照片、非即時預報。
- 攝影素材隨 API 版本內建，每日生成不連外下載、不需 API 金鑰或新增付費服務，離線仍可生成。來源 SHA 驗證失敗則停止產圖，不偷偷回退插畫。

## 不變的功能

07:00 Asia/Taipei 的既有 API 排程、起動補執行、併發／冪等保護、人工發布優先、審核控制、官方 Logo、分享網址、LINE／其他社群分享與下載介面均不變。沒有資料庫 migration，也不提高管理員上傳大小限制、不啟用 Dot 尚未設定的上稿授權。

已有當日正式上稿不會因部署被自動覆蓋。新版本會從下一個尚未上稿的日期產生照片版；若要當天替換，需用既有人工審核發布程序，不應刪除舊紀錄或繞過每日保護。

## 增補圖庫

1. 查看單張原始來源與授權，僅本版允許 CC0；保存作者／來源／日期／授權證據。不能只憑搜尋縮圖認定可商用。
2. 下載並檢查原圖，不使用可辨識人物或第三方商標主體。保持自然照片，不宣稱圖片是當日當地天氣。
3. 校正 EXIF 方向，縮至最長邊 2560 px（不放大）、JPEG quality 90，移除 metadata。記錄原始與處理後 SHA-256、尺寸及處理說明。
4. 新增 catalog 項目並交錯安排不同主題。固定 ID／檔名，避免任意路徑；同步更新圖庫數量測試。每張實際渲染並目視檢查裁切、Logo、中文字；檢查 PNG ≤ 3 MB。
5. 以新 renderer 版本經正常審核發布。不得修改過去已發布的不可變 PNG。

## 發布守則

此目錄的存在不表示正式機已更新。使用 `deployment/PRODUCTION.md`，先確認 Azure **當前 API revision／digest 及其生產專用 overlay**。不可直接用 main 的完整 API 覆蓋未知的生產差異。

本變更僅需要編譯後的 `daily-greeting.js`、新增 `greeting-photo.js` 與 `assets/photos/`。`nest-cli.json` 的資產規則已包含新圖庫。若採既有 production overlay 程序，須從當前正式映像取出基底、只替換這些檔案，驗證其他檔案位元組不變，記錄前後 digest／revision、唯讀健康測試、圖片與次日排程驗證。不要換 member/admin 映像。

回退使用先前 API digest，不刪除圖庫或已上稿紀錄。已上稿照片 PNG 應維持可下載分享。

## 本次本機驗證（2026-11-13）

- 6 個測試檔、36 項測試通過：照片來源／SHA／大小、10 天不重複與主題交錯、全圖庫 PNG 實際渲染、既有 HTTP、週末／節慶、07:00 排程、人工上稿優先、渲染併發及發布邏輯。
- database/shared/settlement 來源套件 TypeScript 建置、API `nest build` 通過。使用既有已安裝依賴並重建工作區套件，非乾淨新機 frozen install 驗證。
- `nest build` 已將 catalog 與十張照片複製到 dist 資產路徑。逐張目視檢查合成結果，見 `evidence/contact-sheet.jpg`。
- 測試指令：在 `backend/apps/api` 執行 `node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --testPathPatterns='(greeting-photo|greeting-art|daily-greeting|greeting-publishing).*e2e-spec'`。
- 預覽重生：在同一目錄執行 `node render-photo-preview.cjs`（需要既有 ts-node 與 Noto CJK 字型）；輸出為本機忽略提交的 `evidence/previews/`。
- 未完成：完整資料庫整合／RC gate、正式 overlay 基底與 Azure 映像／revision 驗證、正式部署、真機分享與次日排程驗證。David-PC-888 於檢查時離線；本雲端環境無 Azure CLI／發布身分。**尚未上線**。
