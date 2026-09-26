# UCell 系統圖示與成就徽章規格

**狀態：** 已依現行程式規格建立 UI 元件並整合至 Admin / Member。
**目的：** 圖示只改善辨識與品牌體驗，不改變任何 Business Core、資格、全球池或獎金判定。

## 1. 真實系統來源

本次設計直接對應現行 repository：

- Admin 功能選單：`admin/src/app/nav.ts`
- Member 主選單：`member/src/MemberNavigation.tsx`
- 會員資格 Plan Level：`STARTER / ELITE / LEADER`
- 全球池成就代碼：Prisma `GlobalRankCode`
  - `NEW_STAR`
  - `EXCELLENCE`
  - `GLORY`
  - `DIAMOND`
  - `CROWN`
- 全球池現行計算：`backend/apps/api/src/modules/global-pool/global-pool.service.ts`
- 全球池參數來源：`backend/packages/database/prisma/migrations/0004_reversal_epv_global_payout/migration.sql`

不使用先前概念海報中不存在於現行程式的虛構等級。

## 2. 會員資格徽章

| 系統代碼 | 中文顯示 | 視覺語意 |
|---|---|---|
| STARTER | 啟航 | 航向／啟動 |
| ELITE | 菁英 | 盾章／成長 |
| LEADER | 領袖 | 皇冠／領導 |

徽章只呈現伺服器已提供的 `rank / planLevelCode`，前端不得自行推算資格。

## 3. 全球池成就徽章

| GlobalRankCode | 中文 UI | 現行弱區門檻 | 現行池切片率 |
|---|---|---:|---:|
| NEW_STAR | 新星 | 300,000 | 1.5% |
| EXCELLENCE | 卓越 | 600,000 | 1.0% |
| GLORY | 榮耀 | 1,000,000 | 0.5% |
| DIAMOND | 鑽石 | 2,000,000 | 0.5% |
| CROWN | 皇冠 | 4,000,000 | 1.5% |

成就是歷史型；現行 GlobalPoolService 已明定 achievement passed 後不降級。當月分配仍需符合 Active 與當月弱區門檻等伺服器規則。

目前 Member API 尚未提供 member-safe 全球成就 read model，因此 **不得在 Member 前端假裝顯示已達成徽章**。本次先：
- 將五階徽章加入 shared design system；
- 在 Admin 全球池區顯示真實 rank 規格；
- 待後端正式提供 member-safe achievement read model 後，再把已達成徽章接入 Member「我的成就」。

## 4. Admin 功能圖示對應

依 `admin/src/app/nav.ts` 現有功能逐項建立：

- 總覽 → dashboard
- 會員／自然人 → people
- 會員申請 → applications
- 既有會員 LINE 補綁 → line-links
- 紙本申請 Intake → paper-intake
- 會員資格（球） → qualifications
- 商品參照 → products
- 套組與資格商品 → packages
- 訂單與收款 → orders
- 多樹管理 → binary-trees
- 組織／安置 → organization
- 重購訂閱 → subscriptions
- 獎金與結算證據 → bonuses
- 退貨／重算 → returns
- 升級／轉讓／退出 → workflows
- Reservoir Center → reservoirs
- 付款批次與對帳 → payouts
- 影音／連結內容 → content
- 文件／附件 → documents
- 稽核紀錄 → audit
- 報表／完整性 → reports
- NASL／十二代健康雷達 → analytics
- UAT／上線驗證 → uat
- 系統就緒度 → system
- Provider Webhook 營運 → provider-operations

## 5. Member 主選單圖示

依現行五個主區：

- 首頁 → home
- 組織 → organization
- 收益 → income
- 商城 → shop
- 我的 → me

首頁「快速服務」亦改用對應功能圖示，不再使用 01/02/03 純編號裝飾。

## 6. 實作原則

- 使用 shared design system 的 inline SVG；不依賴外部 icon CDN。
- 圖示 `currentColor`，可自然支援後續 Light/Dark Theme。
- 裝飾圖示 `aria-hidden`，不重複朗讀文字標籤。
- 徽章使用 canonical code 決定樣式，不用圖片文字作為 Business Authority。
- 未知 qualification/global rank 不自行猜測，徽章元件 fail-safe 不顯示。
- 不因徽章改變任何資格、Active、全球池、獎金、Payable 或隱私邏輯。

## 7. 已整合位置

- `shared/design-system/icons.tsx`
- `shared/design-system/components.css`
- `admin/src/app/AppShell.tsx`
- `admin/src/features/qualifications/QualificationsPage.tsx`
- `admin/src/features/bonuses/BonusesPage.tsx`
- `member/src/MemberNavigation.tsx`
- `member/src/App.tsx`

## 8. 後續

若要在 Member 顯示「已達成的全球池徽章」，必須先建立 authoritative member-safe Global Rank Achievement read model/API，再由 UI 顯示；禁止從當期 PV、弱區數字或獎金紀錄在瀏覽器自行推算。
