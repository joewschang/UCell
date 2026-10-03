export type FinanceReviewDownload={fileName:string;mediaType:string;content:string;fileHash:string;purpose:string};
export async function verifyFinanceReviewDownload(file:FinanceReviewDownload){
 if(!file||file.purpose!=='FINANCE_REVIEW_ONLY'||file.mediaType!=='text/csv;charset=utf-8'||!/^ucell-finance-review-r[1-9][0-9]*\.csv$/.test(file.fileName)||typeof file.content!=='string'||!/^[a-f0-9]{64}$/.test(file.fileHash))throw new Error('財務覆核檔案格式不正確，請重新下載。');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(file.content)))).map(value=>value.toString(16).padStart(2,'0')).join('');
 if(digest!==file.fileHash)throw new Error('檔案完整性核對失敗，已停止下載，請重新核對匯出紀錄。');
}
export async function saveFinanceReviewDownload(file:FinanceReviewDownload){
 await verifyFinanceReviewDownload(file);
 const url=URL.createObjectURL(new Blob([file.content],{type:file.mediaType})),link=document.createElement('a');
 try{link.href=url;link.download=file.fileName;link.style.display='none';document.body.appendChild(link);link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
