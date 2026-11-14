const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.argv[2],index=path.join(root,'index.html'),html=fs.readFileSync(index,'utf8');
const entry=html.match(/<script type="module" crossorigin src="(\/assets\/[^"]+\.js)"/)[1];
let s=fs.readFileSync(path.join(root,entry),'utf8');
function once(a,b){if(s.split(a).length!==2)throw Error('Unexpected: '+a);s=s.replace(a,()=>b);}
once('if(e.password.length<6||e.password.length>256||!/[A-Za-z]/.test(e.password)||!/[0-9]/.test(e.password))','if(!e.lineIdToken&&(e.password.length<6||e.password.length>256||!/[A-Za-z]/.test(e.password)||!/[0-9]/.test(e.password)))');
once('d(1);return}if(Qn!==W)','d(1);return}if(!ue&&Qn!==W)');
once('password:Qn,mobileVerificationProof:L','...ue?{}:{password:Qn},mobileVerificationProof:L');
once('!g&&r.jsxs(r.Fragment,{children:[r.jsx("p",{className:"uc-auth-message",children:"密碼至少','!g&&!ue&&r.jsxs(r.Fragment,{children:[r.jsx("p",{className:"uc-auth-message",children:"密碼至少');
once('!g&&r.jsxs("label",{className:"uc-auth-check"','!g&&!ue&&r.jsxs("label",{className:"uc-auth-check"');
once('children:"密碼不在確認頁顯示。需修改資料時，請返回上一步。"','children:ue?"完成註冊後即可使用 LINE 登入。日後可到「我的」設定登入密碼。":"密碼不在確認頁顯示。需修改資料時，請返回上一步。"');
once('return r.jsxs("form",{className:"card",onSubmit:M,children:[r.jsx("h3",{children:"Email 驗證與聯絡資料"})','return r.jsxs(r.Fragment,{children:[r.jsxs("form",{className:"card",onSubmit:M,children:[r.jsx("h3",{children:"Email 驗證與聯絡資料"})');
once('"儲存聯絡資料"})]})}const Im','"儲存聯絡資料"})]}),r.jsx(PasswordCard,{})]})}const PasswordCard=firstPassword(h,r.jsx,q);const Im');
s='import {firstPassword} from "/assets/first-password-v1.js";\n'+s;
const out='/assets/member-password-'+crypto.createHash('sha256').update(s).digest('hex').slice(0,12)+'.js';
fs.writeFileSync(path.join(root,out),s);fs.writeFileSync(index,html.replace(entry,out));
