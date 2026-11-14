const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.argv[2],index=path.join(root,'index.html'),html=fs.readFileSync(index,'utf8');
const entry=html.match(/<script type="module" crossorigin src="(\/assets\/[^"]+\.js)"/)[1];
let s=fs.readFileSync(path.join(root,entry),'utf8');
function once(a,b){if(s.split(a).length!==2)throw Error('Unexpected registration actions');s=s.replace(a,()=>b);}
const back='u>0&&r.jsx(A,{busy:!!m,error:S||de,type:"button",disabled:m,onClick:()=>{d(re=>re-1),H(!1),C("")},children:"上一步"})';
once(back+',','');
const last='onClick:()=>c("login"),children:"登入原帳號"})]})';
once(last+']})','onClick:()=>c("login"),children:"登入原帳號"}),'+back+']})]})');
once('return rh(await kn("/auth/member/register/complete"', 'try{return rh(await kn("/auth/member/register/complete"');
once('accepted:!0})}))}function EA','accepted:!0})}))}catch(err){const messages={LINE_IDENTITY_ALREADY_LINKED:"此 LINE 已綁定會員帳號，請使用原帳號登入。",LINE_LINK_ALREADY_BOUND:"LINE 綁定狀態已變更，請重新開啟會員中心確認。",MOBILE_ALREADY_REGISTERED:"此手機已登記於會員帳號，請登入原帳號或聯絡客服確認。"};if(Object.hasOwn(messages,err.message))throw Error(messages[err.message]);throw err}}function EA');
const out='/assets/line-registration-actions-'+crypto.createHash('sha256').update(s).digest('hex').slice(0,12)+'.js';
fs.writeFileSync(path.join(root,out),s);fs.writeFileSync(index,html.replace(entry,out));


