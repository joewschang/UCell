const admin=document.body.dataset.role==='admin';
const role=admin?'admin':sessionStorage.getItem('ucell_member_token')?'member':'public';
const status=document.querySelector('#status'),tools=document.querySelector('#tools'),panel=document.querySelector('#panel');
let model,selected=new URL(location.href).searchParams.get('tag')||'',category='',search='',itemId='',busy=false,reviewOnly=false;
function el(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
function group(...nodes){const n=el('div',null,'row');n.append(...nodes);return n;}
function btn(text,fn,cls){const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;}
function field(title,node){const l=el('label',title);l.append(node);return l;}
function select(values,initial){const n=el('select');for(const v of values){const o=el('option',v);o.value=v;n.append(o);}n.value=initial;return n;}
function chip(t){const a=el('a','#'+t,'chip'+(selected===t?' selected':''));const u=new URL(location.href);u.searchParams.set('tag',t);a.href=u.href;a.onclick=e=>{if(e.ctrlKey||e.metaKey)return;e.preventDefault();selected=t;history.pushState(null,'',u);render();};return a;}
async function api(path,body){
 const token=sessionStorage.getItem('ucell_'+role+'_token'),headers={};
 if(token)headers.Authorization='Bearer '+token;
 if(body)headers['Content-Type']='application/json';
 const r=await fetch('https://api.ucell.life/api/v1/'+role+'/health-game/topics'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(35000),cache:'no-store'});
 if(!r.ok)throw Error(({401:'請先登入後再開啟。',403:'此帳號沒有標籤管理權限。',409:'資料有更新，請重新載入再操作。',400:'請確認名稱與關係格式。',503:'AI 暫時無法產生建議，稍後會重試。'})[r.status]||'無法讀取資料，請再試一次。');
 return (await r.json()).data;
}
async function load(){model=await api('');if(Object.hasOwn(model.aliases??{},selected))selected=model.aliases[selected];render();}
async function action(path,body,done){if(busy)return;busy=true;panel.inert=true;status.textContent=path?'AI 正在閱讀這項資源…':'儲存中…';try{await api(path,{...body,version:model.version});await load();status.textContent=done;}catch(e){status.textContent=e.message;}finally{busy=false;panel.inert=false;}}
function render(){
 tools.replaceChildren();panel.replaceChildren();
 const input=el('input');input.type='search';input.value=search;input.placeholder='輸入名稱或標籤';input.oninput=()=>{search=input.value.trim();draw();};
 tools.append(field('搜尋資源',input));
 const kinds=select(['全部類型',...new Set(model.rows.map(r=>r.kind))],category||'全部類型');kinds.onchange=()=>{category=kinds.value==='全部類型'?'':kinds.value;draw();};tools.append(field('資源類型',kinds));
 if(admin){const toggle=el('input');toggle.type='checkbox';toggle.checked=reviewOnly;toggle.onchange=()=>{reviewOnly=toggle.checked;draw();};tools.append(group(toggle,Object.assign(el('label','只看待審 AI 建議'),{htmlFor:toggle.id='review-only'})));}
 draw();
}
function draw(){
 panel.replaceChildren();
 if(!model)return;
 const tagList=group(...model.tags.filter(t=>!search||selected===t||t.includes(search)).map(chip));
 panel.append(tagList);
 if(selected){
 const reset=btn('清除主題',()=>{selected='';const u=new URL(location.href);u.searchParams.delete('tag');history.pushState(null,'',u);render();});
 panel.append(group(el('h2','#'+selected),reset));
 const related=model.edges.filter(e=>e.a===selected||e.b===selected);
 if(related.length){const box=el('div',null,'card');box.append(el('strong','相關主題'));for(const edge of related){const other=edge.a===selected?edge.b:edge.a;box.append(group(el('small',edge.a+' → '+edge.kind+' → '+edge.b),chip(other)));}panel.append(box);}
 }
 const rows=model.rows.filter(r=>(!category||category===r.kind)&&(!selected||r.tags.includes(selected))&&(!search||[r.title,...r.tags].some(x=>x.toLowerCase().includes(search.toLowerCase())))&&(!reviewOnly||model.jobs?.some(j=>j.id===r.id&&j.state==='review')));
 panel.append(el('h2','資源（'+rows.length+'）'));const cards=el('div',null,'cards');panel.append(cards);
 for(const r of rows){const card=el('article',null,'card');card.append(el('small',r.kind+(admin?' · '+({PUBLISHED:'已發布',ARCHIVED:'已封存',DRAFT:'草稿'}[r.status]||r.status):'')),el('h3',r.title),group(...r.tags.map(chip)));
 if(admin){card.append(btn(itemId===r.id?'收合':'管理標籤',()=>{itemId=itemId===r.id?'':r.id;draw();}));if(itemId===r.id)editor(card,r);}
 else {const a=el('a',({商品:'查看商品',遊戲:'開始遊戲',活動:'查看活動',課程:'查看課程'})[r.kind]||'閱讀內容');a.href=r.href;card.append(a);}cards.append(card);}
 if(!rows.length)panel.append(el('p','沒有符合條件的資源。'));
 if(admin){dictionary();edgesPanel();}
}
function editor(card,r){
 const tags=el('input');tags.value=r.tags.join('、');
 card.append(field('標籤（以頓號或逗號分隔）',tags),group(btn('儲存標籤',()=>action('',{action:'assign',id:r.id,tags:tags.value.split(/[、,，]/).map(v=>v.trim()).filter(Boolean)},'標籤已儲存。'),'primary'),btn('請 AI 建議',()=>action('/generate',{id:r.id},'已取得 AI 建議。'))));
 const j=model.jobs.find(j=>j.id===r.id);
 if(j?.state==='retry')card.append(el('p','AI 分析等待重試。'));
 if(j?.state!=='review')return;
 card.append(el('h3','AI 建議與原文依據'));
 for(const t of j.proposal.tags)card.append(el('p','#'+t.name+' · '+t.evidence));
 for(const e of j.proposal.edges)card.append(el('p',e.a+' → '+e.kind+' → '+e.b+' · '+e.evidence));
 if(!j.proposal.tags.length)card.append(el('p','這項資源的文字不足以產生有依據的標籤。'));
 const change=a=>action('',{id:r.id,action:a,proposalKey:j.key},a==='apply'?'已加入建議標籤與關聯。':'已略過這次建議。');
 card.append(group(btn('採用建議',()=>change('apply')),btn('略過',()=>change('dismiss'))));
}
function edgesPanel(){
 const d=el('details');d.append(el('summary','管理標籤間的關聯（'+model.edges.length+'）'));
 const a=select(model.tags,selected||model.tags[0]),b=select(model.tags,model.tags.find(t=>t!==a.value)),kind=el('input');kind.value='相關主題';
 d.append(field('來源標籤',a),field('關係',kind),field('目標標籤',b),btn('新增關聯',()=>action('',{action:'edge',a:a.value,b:b.value,kind:kind.value.trim()},'關聯已儲存。')));
 for(const e of model.edges)d.append(group(el('span',e.a+' → '+e.kind+' → '+e.b),btn('移除',()=>{if(confirm('移除這一筆關聯？'))action('',{action:'removeEdge',...e},'已移除關聯。');})));
 panel.append(d);
}
if(admin){document.title='標籤管理｜UCell';document.querySelector('#title').textContent='標籤管理';const back=document.querySelector('#back');back.href='/';back.textContent='‹ 返回管理後台';}
window.onpopstate=()=>{selected=new URL(location.href).searchParams.get('tag')||'';render();};
load().then(()=>status.textContent='').catch(e=>{status.textContent=e.message;tools.append(btn('重新載入',()=>location.reload()));});

function dictionary(){
 const d=el('details');d.append(el('summary','維護標籤名稱、合併與封存'));
 const old=select(model.tags,selected||model.tags[0]),name=el('input');name.maxLength=18;
 const target=select(model.tags,model.tags.find(t=>t!==old.value));
 const send=(actionName,from,to)=>action('',{action:actionName,name:from,target:to},'標籤庫已更新。');
 d.append(field('現有標籤',old),field('新名稱',name),group(btn('建立標籤',()=>send('createTag',name.value.trim())),btn('變更名稱',()=>send('renameTag',old.value,name.value.trim()))),field('合併到',target),
 group(btn('合併標籤',()=>{if(confirm('將「'+old.value+'」的資源和關聯合併至「'+target.value+'」？'))send('mergeTag',old.value,target.value);}),btn('封存',()=>{if(confirm('將「'+old.value+'」從前台隱藏？'))send('archiveTag',old.value);})));
 for(const archived of model.archived??[])d.append(group(el('span',archived+'（已封存）'),btn('恢復',()=>send('restoreTag',archived))));
 panel.append(d);
}