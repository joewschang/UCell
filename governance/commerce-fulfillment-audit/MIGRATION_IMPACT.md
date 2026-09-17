# Migration impact analysis

本輪不執行 migration。Prisma schema 與 39 份歷史 SQL 的 SHA-256 manifest 見 evidence.json；本輪不修改其內容。既有 migrations 同時使用四位流水號與十四位 timestamp，Owner 必須配置下一個唯一 prefix，不能每條支線各自生成。

## Proposed sequence

1. B1 contracts/proposal freeze：無 DDL、無 deployment DB 影響。
2. B2 Owner 批次：新增 payment/evidence/reconciliation tables、指向 existing order/payment_event 的 additive FK；舊 manual payment route 保持既有語意，啟用 provider 前必須核准 authority gate/bridge，禁止雙寫 paid effect。
3. B3 Owner 批次：warehouse/item/reservation/movement/lot/serial/policy；無 inferred stock seed。依盤點核准 importing receipt evidence，reconcile 再開啟 reserve。
4. B4–B5：order delivery snapshot / fulfillment / scan / parcel / QC；existing Order enum 不承擔新 logistics 狀態。
5. B6–B7：shipment/invoice evidence/config；分別開啟 Adapter，flags default disabled。
6. B9：RMA overlay / unique ReturnCase link / independent downstream jobs；legacy monetary history 原封保留。
7. B10：ERP mappings / outbox / reconciliation；default NONE。approved per-domain SoR cutover 後才切換 authority。

## Data / lock / compatibility impact

- 新表先建立，nullable reference/side table 優先；不 rename/drop existing enum/table、PK、monetary columns。
- 新 index / FK / trigger 可能取得 DDL lock；在接近實際規模的 disposable DB 演練時間與 lock timeout。大表 constraint validation/index concurrent 另批規劃，不能假設所有 SQL 在同一 transaction 都相容。
- Multi-schema relations 必須同時 review Prisma 與 SQL：repo 有 SQL FK/trigger 超過 Prisma 字面模型可表达範圍，單 `prisma validate` 不足。
- Decimal price 沿用 Decimal(18,2)，volume/stock 分開；stock unit精度/serial integrality須決定，不轉 float 計算，不遷移 PV/BV 欄位。
- evidence append-only triggers 必須容許專屬 mutable processing/status projections，不可為更新 processedAt 而放寬 immutable payload。
- PackagePurchaseSelection 沒有 orderLineId；同產品不同 rule profile 可重複，不可用 productId 猜對應。需 Owner 決定新增 immutable selection-to-line mapping 或以 checkout snapshot 產生明確關係；歷史無證據時 fail closed。
- Existing Order 必須 qualificationId；不由 Commerce 擅自改成 nullable 來實現 zero-Ball retail checkout。
- Existing ReturnLine.package monetary allocation 不能取零值或 retail total 代替正式 allocation。必要 Core change 獨立交付。
- 不回填 PAN/CVV/secret/provider raw body；safe evidence retaining policy 與 keys 另管。

## Validation after Owner approval

在兩個獨立 localhost random DB 分別做：

- zero -> 全部 migrations -> Prisma generate -> API/Worker build -> fixtures -> HTTP/DB Golden；記錄 migration count/checksums。
- audit baseline migrations/data -> 新 migrations -> before/after immutable snapshots/hash/count reconciliation；確認舊 APIs 與新的 disabled flags 相容。
- DB assertions：negative available 拒絕；兩連線 last unit reserve；duplicate provider capture；serial active claim uniqueness；FK wrong order/item/lot 拒絕；QC FAIL/HOLD dispatch 拒絕；append-only UPDATE/DELETE 拒絕。
- mid-transaction fault / lost response / crash-after-provider-success-before-local-ACK / dead-letter retry；重啟不重複 financial or inventory effect。
- migration/deploy rollback 是 app feature disable + forward repair，不刪除已產生歷史 evidence。任何 restore 僅用隔離 backup/restore 演練，不從共享 DB 擅自回滾。

## Release matrix

本輪 migration-from-zero / upgrade / rollback drill：NOT RUN；不使用 repo 舊 PASS 冒充新證據。沒有 B1 DDL 可部署；Owner/gate 未確認時維持 BLOCKED。
