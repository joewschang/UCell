(()=>{
 'use strict';if(window.__ucellArtworkMode)return;window.__ucellArtworkMode=true;
 const path='/content/greetings',id='ucell-artwork-mode-261116';
 function install(){if(location.pathname.replace(/\/$/,'')!==path)return;const input=document.querySelector('input[type="file"][accept="image/png"]');if(!input||document.getElementById(id))return;
  const label=document.createElement('label');label.textContent='圖片模式 ';label.style.display='block';label.style.margin='12px 0';const select=document.createElement('select');select.id=id;select.setAttribute('aria-label','圖片模式');for(const [value,text] of [['artwork','完整成圖（已含 Logo／QR，保留構圖）'],['background','背景圖（由系統加入 Logo／QR）']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}label.append(select);input.parentElement.insertAdjacentElement('beforebegin',label);
  const note=document.createElement('p');note.textContent='完整成圖不再追加品牌區；既有草稿不會自動修復，請重新上傳原圖並預覽。';label.append(note);
 }
 const original=window.fetch.bind(window);
 window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);if(location.pathname.replace(/\/$/,'')===path&&url.pathname==='/api/v1/admin/daily-greetings'&&String(init?.method).toUpperCase()==='POST'&&typeof init?.body==='string'){
  const body=JSON.parse(init.body),select=document.getElementById(id);if(body.contentBase64&&body.imageMode===undefined){if(!select||!['artwork','background'].includes(select.value))return Promise.reject(new Error('請先選擇圖片模式'));init={...init,body:JSON.stringify({...body,imageMode:select.value})};}
 }return original(input,init);};
 new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('popstate',install);install();
})();
