import {useState} from 'react';
import {Link} from 'react-router-dom';
import './oa-services.css';

const questions=[
 {category:'帳號與會員',question:'如何進入會員中心？',answer:'從官方帳號選單點選「會員中心」，使用 LINE 登入。若尚未連結會員，請依畫面完成帳號連結；既有會員請使用原帳號，不需重複建立。',to:'/me',label:'查看我的帳戶'},
 {category:'帳號與會員',question:'為什麼切換球後，訂單或業績不同？',answer:'每顆球各自記錄訂單與業績。請先確認頁面目前選取的球編號，再查詢對應資料。',to:'/',label:'前往會員中心'},
 {category:'活動報名',question:'如何報名或取消活動？',answer:'到「活動報名」選擇活動，查看時間、地點與名額後按下報名。報名結果以系統紀錄為準；允許取消的活動會顯示取消按鈕。',to:'/events',label:'查看活動'},
 {category:'活動報名',question:'如何取得活動報到憑證？',answer:'完成報名後，在活動詳情取得私人報到憑證，並向現場工作人員出示。重新取得憑證後，舊憑證會失效，請勿公開分享。',to:'/events',label:'我的活動'},
 {category:'商城與訂單',question:'如何查看訂單、付款及配送進度？',answer:'登入後進入「我的訂單」，查看該筆訂單的付款與配送狀態。建立訂單不代表付款完成；最新結果以訂單詳情為準。',to:'/orders',label:'查看我的訂單'},
 {category:'商城與訂單',question:'商品沒有顯示可購買時怎麼辦？',answer:'商品是否可購買依目前商品設定與頁面提示而定。請重新整理商城；若仍無法購買，可回到官方帳號聊天室詢問，並提供商品名稱與錯誤畫面。',to:'/shop',label:'前往線上商城'},
 {category:'服務協助',question:'登入失敗或會員資料有誤怎麼辦？',answer:'可先重新登入 LINE，並確認使用原本連結的帳號。若仍有問題，請回到官方帳號聊天室描述遇到的情況；請勿傳送密碼、一次性驗證碼或登入憑證。',to:'/me',label:'查看會員資料'},
];
export default function Faq(){
 const [query,setQuery]=useState('');
 const visible=questions.filter(q=>(q.category+q.question+q.answer).includes(query.trim()));
 return <section className="oa-faq"><div className="oa-service-heading"><small>UCELL · SUPPORT</small><h1>常見問答</h1><p>讓每一步，都更清楚。</p></div><label className="oa-faq-search">搜尋問題<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="輸入登入、報名或訂單…"/></label><div className="oa-faq-list">{visible.map(q=><details key={q.question}><summary><small>{q.category}</small><span>{q.question}</span></summary><p>{q.answer}</p><Link to={q.to}>{q.label} →</Link></details>)}</div>{!visible.length&&<p role="status">找不到相關問題，請試試其他關鍵字。</p>}<footer className="oa-support-note"><h2>需要進一步協助？</h2><p>請關閉此頁，回到 UCell 官方帳號聊天室留言。</p><Link to="/">返回會員中心</Link></footer></section>;
}
