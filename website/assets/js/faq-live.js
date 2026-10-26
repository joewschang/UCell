// Public knowledge base: published database content replaces the legacy seed.
(async()=>{
 const root=document.querySelector('[data-faq]');if(!root)return;
 root.replaceChildren();
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const title=el('h2','常見問答'),status=el('p','正在載入最新問答…');status.setAttribute('role','status');root.append(title,status);
 try{
  const response=await fetch('/api/public/faq',{cache:'no-store'});if(!response.ok)throw Error();
  const body=await response.json(),data=body.data??body;
  const searchLabel=el('label','搜尋問題 '),search=el('input');search.type='search';search.placeholder='輸入問題或關鍵字';searchLabel.append(search);
  const categoryLabel=el('label',' 問題分類 '),select=el('select'),all=el('option','全部分類');all.value='';select.append(all);
  data.categories.forEach(c=>{const o=el('option',c.label);o.value=c.id;select.append(o)});categoryLabel.append(select);
  const list=el('div');list.className='faq';root.append(searchLabel,categoryLabel,list);
  function render(){const rows=data.items.filter(i=>(!select.value||i.category===select.value)&&(!search.value||(i.question+i.answer+i.keywords).toLowerCase().includes(search.value.trim().toLowerCase())));list.replaceChildren();status.textContent=`找到 ${rows.length} 個問題`;rows.forEach(i=>{const d=el('details'),s=el('summary',i.question),a=el('p',i.answer);a.style.whiteSpace='pre-wrap';d.append(s,a);list.append(d)});}
  search.addEventListener('input',render);select.addEventListener('change',render);render();
 }catch{status.textContent='暫時無法載入常見問答，請重新整理，或聯絡客服。';const link=el('a','聯絡 LINE 官方帳號');link.href='https://lin.ee/pqS11xX';root.append(link);}
})();
