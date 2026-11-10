import {el,box,btn,link,show,apiFor} from './ui.js';
const api=apiFor('admin');let model,search='',kind='全部',busy=false;
function draw(){
 const feedback=el('p');feedback.setAttribute('role','status');
 const active=el('input');active.type='checkbox';active.checked=model.open;active.onchange=()=>model.open=active.checked;
 const tags=el('input');tags.placeholder='例如：平衡練習';tags.maxLength=18;
 const list=el('div',null,'row');const rows=el('div');
 function refreshTags(){list.replaceChildren(...model.tags.map(t=>btn('#'+t+' ×',()=>{
 if(!confirm('移除 #'+t+' 以及此標籤的所有關聯？'))return;
 model.tags=model.tags.filter(x=>x!==t);for(const r of model.resources)r.tags=r.tags.filter(x=>x!==t);
 refreshTags();refreshRows();})));}
 function refreshRows(){
 const visible=model.resources.filter(r=>(kind==='全部'||r.kind===kind)&&r.title.toLowerCase().includes(search.toLowerCase()));
 rows.replaceChildren(...visible.map(r=>{
 const d=el('details');d.append(el('summary',r.kind+' · '+r.title+'　('+r.tags.length+')'));
 const options=el('div',null,'row');
 for(const t of model.tags){const check=el('input');check.type='checkbox';check.checked=r.tags.includes(t);
 check.onchange=()=>{r.tags=check.checked?[...r.tags,t]:r.tags.filter(x=>x!==t);d.firstChild.textContent=r.kind+' · '+r.title+'　('+r.tags.length+')';};
 options.append(box('label','',check,'#'+t));}
 d.append(options);return d;}));
 if(!visible.length)rows.append(el('p','沒有相符的資源。'));
 }
 const query=el('input');query.type='search';query.value=search;query.oninput=()=>{search=query.value;refreshRows();};
 const select=el('select');for(const k of ['全部','內容','商品','遊戲'])select.append(el('option',k));select.value=kind;select.onchange=()=>{kind=select.value;refreshRows();};
 refreshTags();refreshRows();
 const submit=btn('儲存並套用設定',async()=>{if(busy)return;busy=true;submit.disabled=true;
 try{const links=Object.fromEntries(model.resources.filter(r=>r.tags.length).map(r=>[r.id,r.tags]));
 await api('','POST',{open:model.open,version:model.version,tags:model.tags,links});await load('設定已儲存。');}catch(e){feedback.textContent=e.message;}finally{busy=false;submit.disabled=false;}},'primary');
 show(el('h1','健康中心管理'),box('section','',el('h2','居家腿力與骨骼自我觀察'),box('label','',active,'開放會員與訪客參加'),el('p','累計開始 '+model.stats.started+' 人週　／　完成 '+model.stats.finished+' 人週'),el('small','同一會員每週計一次。訪客體驗不列入統計。')),
 box('section','',el('h2','主題標籤'),list,box('div','row',box('label','','新增標籤 ',tags),btn('加入',()=>{const t=tags.value.trim().replace(/^#/,'');if(!/^[-\p{L}\p{N}]{1,18}$/u.test(t)||model.tags.includes(t)||model.tags.length>=50){feedback.textContent='請輸入未使用的 1–18 字標籤，最多 50 個。';return;}model.tags.push(t);tags.value='';refreshTags();refreshRows();}))),
 box('section','',el('h2','關聯遊戲、內容與商品'),el('p','展開項目並勾選標籤。共用標籤的資源會出現在會員的延伸探索；商品僅依主題呈現。'),box('div','row',box('label','','資源類型 ',select),box('label','','搜尋名稱 ',query)),rows),
 box('div','row',submit,btn('重新載入',()=>load())),feedback);
 return feedback;
}
async function load(message=''){try{model=await api('');draw().textContent=message;}catch(e){show(el('h1','健康中心管理'),el('p',e.message),link('回後台登入','/'),btn('重試',()=>load()));}}
load();
