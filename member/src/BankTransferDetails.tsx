import {useState} from 'react';
import './bank-transfer-details.css';
export const receivingBank={name:'彰化第五信用合作社',code:'161',branch:'大里分社',branchCode:'0068',account:'0068-11-07575-2-0',accountDigits:'0068110757520',holder:'宇生國際股份有限公司'};
export default function BankTransferDetails({method,grouped=false}:{method:string;grouped?:boolean}){
 const [notice,setNotice]=useState('');
 if(method!=='BANK_TRANSFER')return null;
 async function copy(){try{await navigator.clipboard.writeText(receivingBank.accountDigits);setNotice('帳號已複製（不含連字號）');}catch{setNotice('無法自動複製，請長按上方帳號複製。');}}
 return <section className="bank-transfer-details" aria-label="銀行匯款收款資訊"><h4>銀行匯款／自動櫃員機轉帳</h4><p><strong>匯款後請至訂單系統中提供匯款帳號末五碼以利核對帳務</strong></p><dl><dt>銀行</dt><dd>{receivingBank.name}（{receivingBank.code}）</dd><dt>分社</dt><dd>{receivingBank.branch}（{receivingBank.branchCode}）</dd><dt>戶名</dt><dd>{receivingBank.holder}</dd><dt>帳號</dt><dd className="bank-transfer-account">{receivingBank.account}</dd></dl><button type="button" className="bank-transfer-copy" onClick={()=>void copy()}>複製帳號</button>{notice&&<p role="status">{notice}</p>}{grouped?<p>匯款後請在本頁回報一次。</p>:<p>請先建立訂單，再依訂單金額匯款。匯款後請提供匯款證明，並至「我的訂單 → 付款資訊／回報付款」填寫匯款資料，供公司核對。</p>}<p>回報匯款不代表已確認收款，實際付款狀態以公司核對結果為準。</p></section>;
}
