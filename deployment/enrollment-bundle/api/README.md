# 會員多資格申請 API 發版

正式 API 同時提供紙本建檔、法人推薦、核款、訂單維護與團體申請。此版本以運行中的 API 映像為底，保留其啟動指令、第三方套件和既有服務。建置會驗證 29 個 JavaScript 檔案的前後 SHA-256，然後在映像內載入會員申請、後台核款、紙本建檔和訂閱排程。

在專案根目錄執行 `node deployment/enrollment-bundle/api/prepare.cjs <建置資料夾>`。該指令驗證來源及五支 SQL，產生 Dockerfile 及必要的 release 檔案。以該資料夾為 Docker 建置 context。建置期間不連資料庫。原始碼、正式映像或 SQL 有變更時，須對照原始碼與映像中實際編譯檔，重新產生並驗證 `runtime-delta.json`。

## 資料庫

候選映像內可執行 `node /app/enrollment-release/migrate.cjs --check`。檢查會列出待執行項目及核對已完成項目的校驗碼。`--trial` 在一筆交易中套用、檢查觸發器並回滾。`--apply` 在一筆交易中鎖定本次更新、執行待辦 SQL 並記錄 Prisma migration journal。再次執行 `--check` 可驗證結果。若要先從既有 API replica 執行，使用 `node deployment/enrollment-bundle/api/replica-command.cjs <建置資料夾>/release --trial <輸出腳本>` 產生對應模式的指令。腳本使用 replica 原有資料庫連線，先核對壓縮內容雜湊再執行。

## 本次驗證

2026-11-12 的 ACR 建置 `cknr` 以 API 底版 `sha256:b7bec1e5ed474f4ff8678ca138dc2c307c2c5e55f2bc6ee1e773563753d664d7` 產生 `ucell-api@sha256:905491d9be7b44c0b8f0c87388a5dc93f94387dbf6b5864d55a0987b8795fb11`。個別訂單的會員取消、後台作廢及匯款回報入口會重新檢查整組付款條件。

隔離 PostgreSQL 使用實機相容的 migrations、一組合成公司資料與正式球號觸發函式。測試直接載入候選映像的服務程式，驗證三顆球六筆明細、尚未指定推薦時的零筆推薦證據、合併收款、會員與後台個別作廢保護、審核、指定外部公司球、層序安置、三球各自生效的三個月訂閱，以及最後一筆失敗後整組回滾與重試。正式資料庫以 trial、apply、check 順序執行，五筆 journal 核對成功。執行後新建組數、收據數與分攤數均為零。

