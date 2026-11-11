const query=new URLSearchParams(location.search),id=query.get('id'),type=query.get('type');
const back=document.querySelector('#back');if(document.referrer&&new URL(document.referrer).origin===location.origin)back.href=document.referrer;
const base='https://api.ucell.life/api/v1/admin/persons/member-type/'+encodeURIComponent(type)+'/'+encodeURIComponent(id);
const root=document.querySelector('#root'),msg=document.querySelector('#feedback');
const make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
function field(box,label,tag='input'){const l=make('label',label),i=make(tag);l.append(i);box.append(l);return i;}
function row(dl,label,text){dl.append(make('dt',label),make('dd',text??'尚未提供'));}
const names={LEGAL_ENTITY:'法人',INDIVIDUAL:'自然人'};
const headers=()=>({Authorization:'Bearer '+(sessionStorage.getItem('ucell_admin_token')??'')});
async function api(url,opts={}){
 const r=await fetch(url,{cache:'no-store',...opts,headers:{...headers(),...opts.headers}});
 if(!r.ok){const e=await r.json().catch(()=>({}));throw Error(r.status===401?'請先登入管理後台。':r.status===403?'此帳號沒有異動會員身分的權限。':e.message||'讀取失敗，請重新載入。');}
 return r;
}
async function download(p){
 const r=await api(base+'/proof/'+encodeURIComponent(p.evidence.id)),blob=await r.blob(),a=make('a');
 const u=URL.createObjectURL(blob);a.href=u;a.download='營業登記.'+({'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'}[blob.type]??'bin');a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);
}
async function open(){
 const p=(await (await api(base)).json()).data;root.replaceChildren();msg.textContent='';
 const details=make('section'),dl=make('dl');details.append(make('h2',p.name),dl);root.append(details);
 row(dl,'會員編號',p.memberNo);row(dl,'目前身分',names[type]);row(dl,type==='LEGAL_ENTITY'?'法人代表':'本人',p.representative);
 row(dl,'個人證件號碼（末四碼）',p.personalIdLast4?'•••• '+p.personalIdLast4:null);
 if(type==='LEGAL_ENTITY'){row(dl,'公司統編',p.registrationNo);if(p.evidence){const d=make('button','下載已登錄營登');d.onclick=()=>download(p).catch(e=>msg.textContent=e.message);details.append(d);}}
 const form=make('form'),section=make('section'),fields=make('fieldset');root.append(form);form.append(section);section.append(fields);
 const target=field(fields,'異動項目','select');
 const options=type==='INDIVIDUAL'?[['LEGAL_ENTITY','自然人改為法人']]:[['LEGAL_ENTITY','補登營登或更正公司統編'],['INDIVIDUAL','法人改為目前代表人（自然人）']];
 for(const [v,t] of options){const o=make('option',t);o.value=v;target.append(o);}
 const corp=make('div');fields.append(corp);const name=field(corp,'公司登記名稱');name.value=type==='LEGAL_ENTITY'?p.name:'';name.readOnly=type==='LEGAL_ENTITY';name.maxLength=150;
 const number=field(corp,'公司統一編號（8 位數）');number.inputMode='numeric';number.pattern='[0-9]{8}';number.maxLength=8;number.value=p.registrationNo??'';
 const file=field(corp,'營業登記文件（PDF、JPG 或 PNG，最多 5 MB）');file.type='file';file.accept='application/pdf,image/jpeg,image/png';
 const reason=field(fields,'異動原因','textarea');reason.required=true;reason.maxLength=300;
 const impact=make('p');fields.append(impact);const submit=make('button','確認儲存');submit.type='submit';fields.append(submit);
 function update(){const company=target.value==='LEGAL_ENTITY';corp.hidden=!company;name.required=number.required=company;file.required=company&&(!p.evidence||number.value!==p.registrationNo);impact.textContent=target.value===type?'文件將以公司統編歸檔。':'將保留會員編號與 '+p.balls+' 顆一般會員球的球號、位置。新身分自儲存當下承接，已產生獎金仍歸原持有人。';}
 target.onchange=number.oninput=update;update();
 let requestId=crypto.randomUUID();
 form.oninput=()=>{requestId=crypto.randomUUID();};
 form.onsubmit=async e=>{e.preventDefault();if(!form.reportValidity())return;
 if(!confirm('確認為 '+p.name+'（'+p.memberNo+'）執行「'+target.selectedOptions[0].textContent+'」？'))return;
 fields.disabled=true;msg.textContent='正在儲存…';
 try{const b={requestId,nextType:target.value,version:p.version,reason:reason.value.trim(),registrationNo:number.value,companyName:name.value};
 if(target.value==='LEGAL_ENTITY'&&file.files.length){const f=file.files[0];if(f.size>5242880)throw Error('文件超過 5 MB');const base64=await new Promise((ok,fail)=>{const r=new FileReader;r.onload=()=>ok(r.result.split(',')[1]);r.onerror=fail;r.readAsDataURL(f);});b.file={base64,mime:f.type};}
 const result=(await (await api(base,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':requestId},body:JSON.stringify(b)})).json()).data;
 if(type!==target.value){const u=new URL(location.href);u.searchParams.set('type',target.value);u.searchParams.set('id',result.id);u.searchParams.set('saved','1');location.replace(u);}
 else{await open();msg.textContent='公司統編與營登已儲存。';}
 }catch(err){msg.textContent=err.message;}finally{fields.disabled=false;}
 };
 if(query.get('saved')==='1')msg.textContent='會員身分已變更。';
}
open().catch(e=>msg.textContent=e.message);
