// Keep published answers available without JavaScript; content/faq.json is the source.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(data) {
  const ids = new Set(), categories = new Set();
  for (const category of data.categories) {
    if (!/^[a-z][a-z-]*$/.test(category.id) || categories.has(category.id) || !category.label) throw Error('Invalid FAQ category');
    categories.add(category.id);
  }
  for (const item of data.items) {
    if (!/^[a-z][a-z-]*$/.test(item.id) || ids.has(item.id) || !categories.has(item.category) || !item.question || !item.answer) throw Error('Invalid FAQ item');
    ids.add(item.id);
    if (!/^[a-z0-9-]+\.html(?:#[a-z0-9-]+)?$/.test(item.link.href) || !fs.existsSync(path.join(root, item.link.href.split('#')[0]))) throw Error('Invalid FAQ destination');
  }
  return `<section class="section support-section"><div class="container" data-faq>
<div class="support-intro"><span class="eyebrow">HELP &amp; GUIDANCE</span><h2>從您的問題開始</h2><p>選擇主題，或搜尋「註冊」、「價格」、「退貨」等關鍵字。</p></div>
<div class="faq-tools" hidden data-faq-tools><label for="faq-search">搜尋常見問題</label><div class="faq-search-row"><input id="faq-search" type="search" maxlength="100" placeholder="輸入問題或關鍵字" autocomplete="off" aria-controls="faq-results"><button type="button" data-faq-clear>清除條件</button></div>
<div class="faq-filters" role="group" aria-label="問題分類"><button type="button" data-faq-category="all" aria-pressed="true">全部 <span>${data.items.length}</span></button>${data.categories.map(c=>`<button type="button" data-faq-category="${c.id}" aria-pressed="false">${esc(c.label)} <span>${data.items.filter(i=>i.category===c.id).length}</span></button>`).join('')}</div>
<p class="faq-status" role="status" aria-live="polite" data-faq-status></p></div>
<div id="faq-results">${data.categories.map(c=>`<section class="faq-group" data-faq-group="${c.id}" aria-labelledby="category-${c.id}"><h3 id="category-${c.id}">${esc(c.label)}</h3><div class="faq">${data.items.filter(i=>i.category===c.id).map(i=>`<details id="faq-${i.id}" data-faq-item data-category="${i.category}" data-keywords="${esc(i.keywords||'')}"><summary>${esc(i.question)}</summary><div class="faq-answer"><p>${esc(i.answer)}</p><div class="faq-answer-actions"><a href="${esc(i.link.href)}">${esc(i.link.label)} →</a><a class="faq-permalink" href="#faq-${i.id}" aria-label="連結至問題：${esc(i.question)}">此題連結</a></div></div></details>`).join('')}</div></section>`).join('')}</div>
<div class="faq-empty" data-faq-empty hidden><h3>暫時沒有符合的問題</h3><p>試試較短的關鍵字，或清除分類與搜尋條件。</p><button type="button" data-faq-reset>顯示全部問題</button><a href="contact.html">需要其他協助 →</a></div>
<aside class="help-contact"><div><h3>還沒有找到答案？</h3><p>依商品、訂單或會員需求，找到合適的服務入口。</p></div><a class="btn btn-navy" href="contact.html">前往聯絡與協助 →</a></aside>
</div></section>`;
}
const start='<!-- FAQ:GENERATED:START -->', end='<!-- FAQ:GENERATED:END -->';
function build() {
  const file=path.join(root,'faq.html'), html=fs.readFileSync(file,'utf8');
  const content=start+'\n'+render(JSON.parse(fs.readFileSync(path.join(root,'content/faq.json'),'utf8')))+'\n'+end;
  if (!html.includes(start)||!html.includes(end)) throw Error('FAQ generation markers missing');
  const next=html.slice(0,html.indexOf(start))+content+html.slice(html.indexOf(end)+end.length);
  if (process.argv.includes('--check')) { if(next!==html)throw Error('FAQ HTML is stale: run node scripts/build-faq.cjs'); }
  else fs.writeFileSync(file,next);
}
if(require.main===module) build();
module.exports={render};
