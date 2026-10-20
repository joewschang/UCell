const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** No visitor identifiers or member-only metadata are rendered into social previews. */
export function shareCardHtml(content:{title:string;summary:string|null;thumbnailUrl:string|null}|null){
 const title=escape(content?.title??'朋友邀請您探索 UCell');
 const summary=escape(content?.summary??'探索 UCell 品牌影音、商品與活動。會員專用內容請登入後查看。');
 return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${title}｜UCell</title><meta name="description" content="${summary}"><meta property="og:type" content="website"><meta property="og:site_name" content="UCell"><meta property="og:title" content="${title}"><meta property="og:description" content="${summary}">${content?.thumbnailUrl?`<meta property="og:image" content="${escape(content.thumbnailUrl)}">`:''}<meta name="robots" content="noindex"><script type="module" src="/share-entry.js"></script></head><body><div id="root"><p>正在載入 UCell 分享內容…</p></div><noscript>請啟用 JavaScript 查看分享內容，或前往 <a href="https://ucell.life/resources.html">UCell 影音中心</a>。</noscript></body></html>`;
}
