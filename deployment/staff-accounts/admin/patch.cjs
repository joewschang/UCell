const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.argv[2],index=path.join(root,'index.html'),html=fs.readFileSync(index,'utf8'),entry=html.match(/src="(\/assets\/admin-[^"]+\.js)"/)[1];let s=fs.readFileSync(path.join(root,entry),'utf8');
function add(a,b){if(s.split(a).length!==2)throw Error(a);s=s.replace(a,()=>b);}
add('["系統就緒度","/system","system"]','["後台登入帳號","/staff-accounts","staff-accounts"],["系統就緒度","/system","system"]');
add('label:"系統管理",paths:[','label:"系統管理",paths:["/staff-accounts",');
add('"/system":["SUPER_ADMIN","COMPLIANCE_AUDIT"]','"/staff-accounts":["SUPER_ADMIN"],"/system":["SUPER_ADMIN","COMPLIANCE_AUDIT"]');
add('e.jsx(lt,{path:"/system",','e.jsx(lt,{path:"/staff-accounts",element:e.jsx(ft,{children:e.jsx(StaffAccounts,{})})}),e.jsx(lt,{path:"/system",');
add('function qN(){','const StaffAccounts=staffPage(f,e.jsx);function qN(){');
s='import {staffPage} from "/assets/staff-accounts-panel.js";\n'+s;
const out='/assets/admin-staff-'+crypto.createHash('sha256').update(s).digest('hex').slice(0,14)+'.js';
fs.writeFileSync(path.join(root,out),s);fs.writeFileSync(index,html.replace(entry,out));
