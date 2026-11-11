export function mountEditor(page,{apiFor,el,box,btn,link,show},draftState){
const api=apiFor('admin');
let model,id='game',busy=false,dirty=false,reason='';
const status=el('p','','j-notice');status.setAttribute('role','status');
const panel=(heading,...items)=>box('section','j-panel',el('h2',heading),...items);
const label=(name,input)=>box('label','',el('span',name),input);
const actions=(...items)=>box('div','j-actions',...items);
const select=(options,value)=>{const n=el('select');for(const [v,t] of options){const o=el('option',t);o.value=v;n.append(o);}n.value=value;return n;};
const gameName=k=>model.registry.find(r=>r.id===k)?.name||k;
const resource=k=>model.resources.find(r=>r.id===k);
const pct=(n,d)=>d?(100*n/d).toFixed(1)+'%':'—';
function numberTable(headings,values){
 if(!values.length)return el('p','目前沒有符合的紀錄。');
 const t=el('table');const head=t.createTHead().insertRow();for(const h of headings)head.append(el('th',h));
 const body=t.createTBody();for(const valuesRow of values){const row=body.insertRow();for(const value of valuesRow)row.append(el('td',String(value)));}
 const region=box('div','j-scroll',t);
 region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label',headings.slice(0,3).join('、')+'等資料');
 return region;
}
async function reload(message='',restore=false){
 model=await api('/journey');if(!page.isConnected)return;
 dirty=false;reason='';
 if(restore&&draftState.value){
  const prior=draftState.value;
  id=prior.id;
  if(prior.revision===model.revision){model.draft=prior.games;reason=prior.reason;dirty=true;message='已保留尚未儲存的草稿。';}
  else message='草稿已有新版，已載入最新設定。';
 }
 draftState.value=null;render();status.textContent=message;
}
async function save(action,extras={}){
 if(busy)return;
 if(action==='publish'&&!confirm('將這份草稿上架？會員會依設定的開放時間看到更新。'))return;
 if(action==='restore'&&!confirm('將選定版本載入草稿？目前草稿會被取代。'))return;
 if(action==='revoke'&&!confirm('撤銷這個檔期現有的邀請連結？'))return;
 busy=true;page.inert=true;
 try{await api('/journey','POST',{action,revision:model.revision,games:model.draft,reason,...extras});await reload(({draft:'已儲存草稿。',publish:'已上架。',restore:'已還原到草稿，可預覽後上架。',revoke:'已撤銷現有邀請。'})[action]);}
 catch(e){status.textContent=e.message+' 可重新載入以取得最新版本。';}
 finally{busy=false;page.inert=false;if(page.isConnected)status.scrollIntoView({block:'nearest'});}
}
function move(arr,i,d){if(i+d<0||i+d>=arr.length)return;[arr[i],arr[i+d]]=[arr[i+d],arr[i]];dirty=true;render();}
function updown(arr,i){const a=btn('上移',()=>move(arr,i,-1)),b=btn('下移',()=>move(arr,i,1));a.disabled=i===0;b.disabled=i===arr.length-1;return [a,b];}
function render(){
 const g=model.draft.find(x=>x.id===id),src=model.registry.find(x=>x.id===id);
 const chosen=select(model.draft.map(x=>[x.id,gameName(x.id)]),id);chosen.onchange=()=>{id=chosen.value;render();};
 const change=()=>{dirty=true;status.textContent='有尚未儲存的異動。';};
 const text=(key,name,max)=>{
  const n=el(key==='description'?'textarea':'input');n.value=g[key];n.maxLength=max;n.oninput=()=>{g[key]=n.value;change();};return label(name,n);
 };
 const date=(key,name)=>{
  const n=el('input');n.type='datetime-local';
  if(g[key]){const d=new Date(g[key]);n.value=new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
  n.oninput=()=>{g[key]=n.value?new Date(n.value).toISOString():'';change();};return label(name,n);
 };
 const check=(key,name)=>{const n=el('input');n.type='checkbox';n.checked=g[key];n.onchange=()=>{g[key]=n.checked;change();};return label(name,n);};
 const covers=select(model.registry.map(x=>[x.cover,x.name]),g.cover);covers.onchange=()=>{g.cover=covers.value;change();};
 const editor=panel('遊戲上架設定',label('選擇遊戲',chosen),actions(el('span','目錄順序 '+(model.draft.indexOf(g)+1)),...updown(model.draft,model.draft.indexOf(g))),
 box('div','j-form',text('description','列表介紹',180),text('interest','會員可選擇的延伸主題',32),text('invite','這支遊戲的分享文案',160),text('campaign','檔期名稱',40),label('列表封面',covers),date('starts','開始時間（本地時間）'),date('ends','結束時間（留白為持續開放）'),check('enabled','開放遊戲'),check('membersOnly','僅限會員體驗')));
 const query=el('input');query.type='search';query.placeholder='輸入名稱或商品代碼';
 const kind=select([['','全部類型'],...Array.from(new Set(model.resources.map(x=>x.kind)),v=>[v,v])],'');
 const options=el('select');options.setAttribute('aria-label','可加入的已發布資源');
 const fill=()=>{options.replaceChildren();for(const r of model.resources.filter(r=>!g.pinned.includes(r.id)&&(!kind.value||r.kind===kind.value)&&(r.title+r.id).toLowerCase().includes(query.value.toLowerCase()))){const o=el('option',r.kind+' ／ '+r.title);o.value=r.id;options.append(o);}};
 query.oninput=fill;kind.onchange=fill;fill();
 const pinned=g.pinned.map((v,i)=>box('div','j-line',el('span',resource(v)?.title||'已下架・請移除'),...updown(g.pinned,i),btn('移除',()=>{g.pinned.splice(i,1);change();render();})));
 const add=btn('加入精選',()=>{if(!options.value)return;if(g.pinned.length>=12){status.textContent='每支遊戲最多可指定 12 項。';return;}g.pinned.push(options.value);change();render();});
 const tags=model.tags.find(t=>t.id===id)?.tags||[];
 const ai=panel('AI 標籤與關聯',el('p',tags.length?tags.map(t=>'#'+t).join('　'):'尚無已採用標籤。'),el('p',model.edges.filter(e=>tags.includes(e.a)||tags.includes(e.b)).slice(0,8).map(e=>e.a+' '+e.kind+' '+e.b).join(' ／ ')),
 link('查看原文、產生或審核 AI 建議','/health/journey/?view=tags&item='+id+'&q='+encodeURIComponent(src.name)));
 const proposal=model.suggestions?.find(j=>j.id===id&&j.state==='review')?.proposal;
 if(proposal){const detail=box('details','',el('summary','待審 AI 建議與原文依據'));
 for(const t of proposal.tags)detail.append(el('p','#'+t.name+'　「'+t.evidence+'」'));
 for(const e of proposal.edges)detail.append(el('p',e.a+' '+e.kind+' '+e.b+'　「'+e.evidence+'」'));ai.append(detail);}
 const preview=el('div');preview.setAttribute('aria-live','polite');
 async function previewFor(member){
   preview.textContent='正在檢查可用資源…';
   try{const rows=await api('/journey/preview','POST',{games:model.draft,game:id,member});
   const img=el('img');img.src='https://member.ucell.life'+g.cover;img.alt='';
   preview.replaceChildren(box('article','j-preview',img,el('h3',src.name),el('p',g.description),el('strong','我想'+g.interest),...(rows.length?rows.map(r=>el('p',r.kind+' ／ '+r.title+(r.detail?' · '+r.detail:''))):[el('p','此身分目前會看到替代閱讀入口。')])));
   }catch(e){preview.textContent=e.message;}
 }
 const hist=select(model.history.map(v=>[String(v.version),'第 '+v.version+' 版 · '+new Date(v.created_at).toLocaleString('zh-TW')]),String(model.version));
 const note=el('input');note.maxLength=200;note.value=reason;note.oninput=()=>{reason=note.value;};
 const history=box('details','',el('summary','異動紀錄'),numberTable(['修訂','操作','原因','時間','操作者'],model.changes.map(c=>[c.revision,({draft:'儲存',publish:'上架',revoke:'撤銷',restore:'還原'})[c.action],c.reason||'—',new Date(c.created_at).toLocaleString('zh-TW'),c.actor])));
 const snapshots=panel('發布與版本',el('p','目前上架第 '+model.version+' 版。草稿第 '+model.revision+' 次修訂。'),label('本次異動原因',note),history,actions(btn('儲存草稿',()=>save('draft')),model.canPublish?btn('審核並上架',()=>save('publish'),'j-primary'):el('span','儲存後由會員營運或系統管理員審核上架。')),label('歷史版本',hist),actions(btn('回復此版至草稿',()=>save('restore',{version:Number(hist.value)})),model.canPublish?btn('撤銷此遊戲本檔期的邀請',()=>save('revoke',{game:id,campaign:g.campaign})):null),link('全站健康遊戲開關','/health/journey/?view=settings'));
 const rows=model.metrics.filter(m=>m.game===id);
 const liveGame=model.live.find(x=>x.id===id);
 const scope=select([['game','這支遊戲'],['all','通用健康中心邀請']],'game');
 const channel=select([['qr','QR 海報'],['line','LINE'],['copy','連結']],'qr');
 const creative=el('div');creative.setAttribute('aria-live','polite');
 const campaign=panel('製作上架版本的邀請',el('p','目前檔期 '+liveGame.campaign+'。連結最長有效 30 天，檔期提前結束時一併到期。'),box('div','j-form',label('邀請對象看的主題',scope),label('分享通路',channel)),btn('產生邀請素材',async()=>{
  try{const generic=scope.value==='all';let owner=localStorage.getItem('health.campaign.owner');if(!owner){owner=crypto.randomUUID();localStorage.setItem('health.campaign.owner',owner);}
  const result=await api('/journey/invite','POST',{visitor:owner,game:id,generic,channel:channel.value});
  const url='https://member.ucell.life/health/journey/invite/'+(generic?'':id+'/')+'?id='+result.id;
  const input=el('input');input.value=url;input.readOnly=true;input.setAttribute('aria-label','邀請網址');input.onclick=()=>input.select();creative.replaceChildren(input,link('預覽邀請',url));
  if(channel.value==='line')creative.append(link('用 LINE 分享','https://line.me/R/share?text='+encodeURIComponent((generic?'邀你體驗 UCell 健康中心。':liveGame.invite)+' '+url)));
  if(channel.value==='qr'){const {toDataURL}=await import('./qr.js');const img=el('img');img.src=await toDataURL(url,{width:480,margin:4});img.width=220;img.alt='本檔期 QR Code';const dl=link('下載邀請 QR Code',img.src);dl.download='UCell-'+(generic?'健康中心':src.name)+'-QR.png';creative.append(img,dl);}
  }catch(e){creative.textContent=e.message;}
 }),creative);
 const analytics=panel('近 30 天成效',el('p','依有效開局與完成次數計算完成率。交易採點擊商品後 7 天內建立且已付款的同品項零售訂單，每筆訂單歸入最後一次符合的點擊，金額以新台幣計。'),
 numberTable(['檔期','開局','完成','完成率','試算','受邀開局人數','每百位完成者帶來開局人數','曝光','點擊','詳情','加入購物車','開始報名'],rows.map(m=>[m.campaign,m.starts,m.finishes,pct(m.finishes,m.starts),m.calculations,m.invited,m.finishers?(100*m.invited/m.finishers).toFixed(1):'—',m.impressions,m.clicks,m.details,m.carts,m.registration_starts])),
 numberTable(['檔期','點商品人數','買家','付款率','訂單','直接成交','輔助成交','付款金額','退款','淨額','活動報名','課程報名'],rows.map(m=>[m.campaign,m.shoppers,m.buyers,pct(m.buyers,m.shoppers),m.orders,m.direct_orders,m.orders-m.direct_orders,m.gross,m.refunds,m.gross-m.refunds,m.bookings,m.courses])),
 el('h3','邀請通路'),numberTable(['檔期','版本','通路','建立連結','分享者','到訪人數','開局人數'],model.channels.filter(x=>x.game===id).map(x=>[x.campaign,x.version,x.channel,x.shares,x.sharers,x.arrivals,x.starts])));
 const jump=select([['','選擇管理區塊']],'');
 const sectionJump=label('前往管理區塊',jump);
 show(box('div','j-heading',el('small','內容與客服'),el('h1','健康中心'),el('p','管理遊戲、編排會員可探索的資源，並查看分享與成效。')),sectionJump,status,editor,panel('編排延伸資源',el('p','精選優先顯示。商品需要手動加入，會員選擇延伸主題後才會顯示。'),...pinned,box('div','j-form',label('搜尋資源',query),label('類型',kind)),options,add),ai,panel('預覽草稿',actions(btn('預覽訪客',()=>previewFor(false)),btn('預覽會員',()=>previewFor(true))),preview),snapshots,campaign,analytics,btn('重新載入',()=>{if(!dirty||confirm('放棄尚未儲存的異動？'))initial();}));
 const headings=[...page.querySelectorAll('.j-panel>h2')];
 headings.forEach((heading,i)=>{const option=el('option',heading.textContent);option.value=String(i);jump.append(option);});
 jump.onchange=()=>{if(jump.value==='')return;const heading=headings[Number(jump.value)];heading.tabIndex=-1;heading.focus({preventScroll:true});heading.scrollIntoView({block:'start'});jump.value='';};
}
async function initial(restore=false){try{await reload('',restore===true);}catch(e){show(el('h1','健康中心管理'),el('p',e.message),link('返回後台登入','/'),btn('重新載入',initial));}}
const beforeUnload=e=>{if(dirty){e.preventDefault();e.returnValue='';}};
window.addEventListener('beforeunload',beforeUnload);
initial(true);
return ()=>{
 window.removeEventListener('beforeunload',beforeUnload);
 if(dirty&&model)draftState.value={revision:model.revision,games:model.draft,id,reason};
};
}
