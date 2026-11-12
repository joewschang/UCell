# 五款主商品新版包裝與說明

來源：公司於 2026-10-29 提供的五張 JPEG 原稿。各檔未重新繪製或修改，SHA-256 記錄於 `manifest.json`。

| 商品 | 新版英文系列 | 包裝標示 |
| --- | --- | --- |
| TIP-363 晶萃源力飲 | THE CORE NEXUS / MitoChrono | 10 瓶／盒 |
| TIP-580 淨衡順 | THE BALANCE / MetaClear | 30 包／盒 |
| TIP-696 活力芯 | THE ESSENTIAL / CoreSurge | 30 包／盒 |
| TIP-777 肽時光膠原飲 | THE COLLAGEN / Luxbeauté | 30 包／盒；單包圖示 20 mL；隨身袋裝 |
| TIP-999 禦力源 | THE VITAL SHIELD / ImmunoFlex | 30 包／盒 |

商品文字摘要及完整原稿由 `member/public/products/catalog-20261029.json` 統一維護；`deployment/prepare-product-packaging-20261029.cjs` 同步至後台與官網。

獨立靜態內容模組更新官網商品說明、商城商品封面與後台縮圖。完整說明收在可展開區塊，套組選品小圖不換成整張海報。此模組不寫入會員、價格、訂單或獎金資料；內容載入失敗時不阻斷既有購物功能。

原稿中的研究、認證與宣傳主題按原稿保留；未新增研究結論、食用劑量或疾病療效保證。完整成分、過敏原與食用方式仍以實際包裝標示為準。

部署必須以各網站當前映像的固定 digest 為基底，只疊加本次靜態檔案及 HTML 引用。不得以舊版主程式取代較新的線上功能。
