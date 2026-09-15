# Admin MVP v0.1.0 Architecture

## 1. Runtime

Browser
→ React Router
→ Feature Page
→ `src/lib/api.ts`
→ `/api/v1/*`
→ Reviewed Backend v0.6.10-R1
→ PostgreSQL

## 2. Frontend boundaries

### App Shell
負責 Navigation、Role-aware menu、Layout，不承載制度邏輯。

### Feature Pages
只做輸入、查詢、Workflow操作與結果呈現。

### API Client
統一：
- API Base URL
- Authorization Header
- `x-request-id`
- JSON serialization
- HTTP error normalization

### Auth
v0.1.0 有 DEV Login 以利UI開發，但不產生假的Backend Token。
Production必須關閉 `VITE_ENABLE_DEMO_LOGIN` 並接後端 AuthSession/Entra。

## 3. Why workbench screens

Reviewed Backend目前多個模組只有「create/get/action」而沒有完整list/search/read-model endpoints。
因此 v0.1.0 對尚未有正式List API的功能採「ID + JSON Workbench」：
- 不捏造後端資料
- 可以直接聯調真實API
- 後續新增正式List API後再升級成Data Grid

## 4. Security

Frontend UI RBAC只用於使用體驗，不是安全邊界。
Backend RBAC/ABAC/Qualification temporal ownership才是正式安全邊界。

## 5. ERP boundary

Admin MVP不重做完整ERP。
目前 Product/Order/Payment 是UCell Core在ERP導入前需要的橋接資料。
未來D365 BC接管：
- 商品主檔
- 庫存
- 採購
- 出貨
- 應收/應付
- 會計
而UCell Core繼續負責Qualification、Organization、PV、Award、Rule Engine。
