import {el,box,link,btn,apiFor} from '../context-ui.js';
const api=apiFor('public'),main=document.querySelector('main'),code=new URL(location.href).searchParams.get('id');
async function load(){
 try{
   const [result,index]=await Promise.all([api('/journey/invite?id='+encodeURIComponent(code||'')),api('/journey')]);
   const g=index.games.find(g=>g.id===result.game);
   const url=new URL(g?.href||'/health/',location.origin);
   if(code&&!result.expired)url.searchParams.set('invite',code);
   const image=el('img');if(g){image.src=g.cover;image.alt='';}
   main.replaceChildren(box('section','j-invite',g?image:null,box('div','j-pad',el('small','UCell 健康中心'),el('h1',g?.name||'一起來玩健康任務'),el('p',result.expired?'原邀請已到期，可以繼續體驗目前開放的遊戲。':g?.description||'選一個感興趣的生活主題開始。'),link(g?'進入遊戲':'探索健康中心',url.href,'j-primary'))));
 }catch(e){main.replaceChildren(el('p',e.message),btn('再試一次',load),link('開啟健康中心','/health/'));}
}
load();
