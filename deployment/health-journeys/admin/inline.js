import {apiFor,el,box,btn,link} from './elements.js';
import {mountEditor} from './manage.js';
import {mountSettings} from './settings-panel.js';
import {mountTags} from './tags-panel.js';

const home='/health/journey/';
export function healthRoute(React,jsx,useLocation,useNavigate){
 return function HealthCenter(){
  const host=React.useRef(null),location=useLocation(),navigate=useNavigate();
  const params=new URLSearchParams(location.search);
  const view=params.get('view')||'editor';
  React.useEffect(()=>{
   const container=host.current,page=el('div'),body=el('div');
   body.className='health-panel-body';body.tabIndex=-1;
   container.replaceChildren(page);
   if(view==='settings'||view==='tags')page.append(link('‹ 返回健康中心',home));
   page.append(body);
   function follow(event){
    const a=event.target.closest('a[href]');
    if(!a||event.defaultPrevented||event.button!==0||event.ctrlKey||event.shiftKey||event.metaKey||event.altKey||a.hasAttribute('download')||a.target&&a.target!=='_self')return;
    const url=new URL(a.href);
    if(url.origin!==window.location.origin||![home,'/'].includes(url.pathname))return;
    event.preventDefault();navigate(url.pathname+url.search+url.hash);
   }
   page.addEventListener('click',follow);
   const show=(...items)=>{body.replaceChildren(...items);};
   const ui={apiFor,el,box,btn,link,show};
   let dispose;
   if(view==='settings')mountSettings(body,ui);
   else if(view==='tags')mountTags(body,navigate);
   else dispose=mountEditor(body,ui,draftForSession());
   return ()=>{dispose?.();page.removeEventListener('click',follow);page.remove();};
  },[view,location.search,navigate]);
  return jsx('div',{className:'uc-health-panel',ref:host});
 };
}
let owner,cache;
function draftForSession(){
 const current=sessionStorage.getItem('ucell_admin_token');
 if(owner!==current||!cache){owner=current;cache={value:null};}
 return cache;
}
