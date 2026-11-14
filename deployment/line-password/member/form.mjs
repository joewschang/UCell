export function firstPassword(React,jsx,api){
 return function PasswordCard(){
  const [info,setInfo]=React.useState(null),[open,expand]=React.useState(false),[pass,setPass]=React.useState(''),[repeat,setRepeat]=React.useState(''),[visible,show]=React.useState(false),[error,fail]=React.useState(''),[busy,working]=React.useState(false),[attempt,reload]=React.useState(0);
  React.useEffect(()=>{
    const abort=new AbortController();
    api('/member/identity',{signal:abort.signal}).then(data=>{if(!abort.signal.aborted)setInfo(data)}).catch(()=>{if(!abort.signal.aborted)fail('無法讀取密碼狀態，請重試。')});
    return ()=>abort.abort();
  },[attempt]);
  if(info&&!info.line)return null;
  function close(){expand(false);setPass('');setRepeat('');show(false);fail('');}
  async function save(e){
    e.preventDefault();if(busy)return;
    if(pass!==repeat){fail('兩次密碼不同，請重新確認。');return;}
    working(true);fail('');
    try{await api('/member/identity/password/initial',{method:'POST',body:JSON.stringify({password:pass})});close();setInfo({...info,hasPassword:true});}
    catch(e){if(e.status===409){close();setInfo({...info,hasPassword:true});}else fail('密碼儲存未完成，請確認連線後再試。');}
    finally{working(false);}
  }
  const field=(label,value,setter)=>jsx('label',{children:[label,jsx('input',{type:visible?'text':'password',autoComplete:'new-password',minLength:6,maxLength:256,pattern:'(?=.*[A-Za-z])(?=.*[0-9]).{6,256}',required:true,value,onChange:e=>setter(e.target.value)})]});
  return jsx('section',{className:'card uc-web-entry','aria-label':'登入密碼',children:[
    jsx('h3',{children:'登入密碼'}),error&&jsx('p',{role:'alert',children:error}),
    !info?(error?jsx('button',{type:'button',onClick:()=>{fail('');reload(attempt+1)},children:'重新讀取'}):jsx('p',{role:'status',children:'正在讀取…'})):
    info.hasPassword?jsx('p',{role:'status',children:'已設定登入密碼。'}):
    open?jsx('form',{className:'uc-auth-form',onSubmit:save,children:[
      jsx('p',{children:'請輸入 6 至 256 碼，至少包含一個英文字母與一個數字。'}),
      field('新密碼',pass,setPass),field('確認新密碼',repeat,setRepeat),
      jsx('label',{className:'uc-auth-check',children:[jsx('input',{type:'checkbox',checked:visible,onChange:e=>show(e.target.checked)}),'顯示密碼']}),
      jsx('button',{className:'primary',disabled:busy,children:busy?'儲存中…':'儲存密碼'}),
      jsx('button',{type:'button',disabled:busy,onClick:close,children:'取消'})
    ]}):jsx(React.Fragment,{children:[jsx('p',{children:'您目前可用 LINE 登入。設定密碼後，也能用會員編號與密碼登入網頁版。'}),jsx('button',{type:'button',className:'primary',onClick:()=>expand(true),children:'設定登入密碼'})]})
  ]});
 };
}
