# 正式機直接發布

1. 在對應的工作目錄執行型別檢查、受影響的測試與建置。需要資料庫的測試使用本機或 CI 臨時 PostgreSQL。正式站的冒煙測試使用唯讀入口。
2. 比對正式機目前 revision 與程式來源，只建置變更元件。以該次通過測試的程式建立映像，在正式 ACR 取得 sha256 digest。正式機已有個別修正版時，沿用已驗證基底或先整合差異。
3. 以現有 Azure 發布身分執行下列命令。先填入真實的元件、映像 digest 與目前 revision。加上 `-WhatIf` 可預覽更新。一次只發布一個元件，同一元件請依序發布。

   ```powershell
   ./deployment/publish-production.ps1 -Component member -Digest $digest -ExpectedRevision $currentRevision
   ```
4. 腳本列出更新前映像，等待新 revision 就緒，並檢查公開入口。驗證這次變更對應的操作。Worker、簡訊出口另從既有監控確認排程與交付；測試不觸發會員通知。
5. 回復時使用前一版映像的 digest，以目前 revision 重跑同一腳本。發布前若舊映像使用 tag，先由 ACR 解析並記下其 digest。有資料庫異動時採向後相容的 migration，先確認可還原時間與資料修復步驟，再發布依賴新欄位的程式。

發版紀錄保留來源提交、元件、前後 digest、revision 及驗證結果。正式站依賴的映像與回復版本列入保留清單。歷史檔名中的 Stage 代表當時的環境，日常開發與發版從本文件進入。
