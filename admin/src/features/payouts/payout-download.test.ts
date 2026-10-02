import {expect,it} from 'vitest';
import {verifyFinanceReviewDownload} from './payout-download';
it('verifies exact UTF-8 review bytes before allowing browser download',async()=>{
 const content='\uFEFF"會員編號"\r\n"M100"\r\n';const file={fileName:'ucell-finance-review-r1.csv',mediaType:'text/csv;charset=utf-8',purpose:'FINANCE_REVIEW_ONLY',content,fileHash:'501fcb3e3c8143baf5fed0266b9bb38380b8aa0b66e818f6acf671e5364edeec'};
 await expect(verifyFinanceReviewDownload(file)).resolves.toBeUndefined();
 await expect(verifyFinanceReviewDownload({...file,content:content+'changed'})).rejects.toThrow('檔案完整性核對失敗');
 await expect(verifyFinanceReviewDownload({...file,fileName:'../unsafe.csv'})).rejects.toThrow('格式不正確');
});
