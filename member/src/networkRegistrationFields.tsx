export function RequiredMark(){return <span style={{color:'#c62828',display:'inline'}} aria-label="必填"> *</span>;}
export function registrationContactError(mobile:string,email:string){
 if(!mobile.trim()&&!email.trim())return '請至少填寫手機號碼或 Email 其中一項。';
 const phone=mobile.trim().replace(/[\s()-]/g,'').replace(/^09(\d{8})$/,'+8869$1');
 if(phone&&!/^\+[1-9][0-9]{7,14}$/.test(phone))return '手機號碼格式不正確，台灣手機請輸入 09 開頭的十碼號碼。';
 if(email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))return '請輸入有效的 Email。';
 return '';
}
