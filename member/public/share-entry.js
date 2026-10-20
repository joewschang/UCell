// Load the current fingerprinted SPA assets without putting deployment hashes in API responses.
try {
 const response=await fetch('/index.html',{cache:'no-store',credentials:'omit'});
 if(!response.ok)throw new Error('manifest');
 const page=new DOMParser().parseFromString(await response.text(),'text/html');
 for(const node of page.querySelectorAll('link[rel="stylesheet"]')){
  const path=node.getAttribute('href');
  if(path&&/^\/assets\/[A-Za-z0-9_.-]+\.css$/.test(path)){const link=document.createElement('link');link.rel='stylesheet';link.href=path;document.head.append(link);}
 }
 const entry=page.querySelector('script[type="module"][src]')?.getAttribute('src');
 if(!entry||!/^\/assets\/[A-Za-z0-9_.-]+\.js$/.test(entry))throw new Error('entry');
 await import(entry);
}catch{
 const root=document.getElementById('root');
 if(root){root.replaceChildren();const text=document.createElement('p');text.textContent='頁面暫時無法載入，請重新整理後再試。';const link=document.createElement('a');link.href='https://ucell.life/resources.html';link.textContent='探索 UCell 影音中心';root.append(text,link);}
}
