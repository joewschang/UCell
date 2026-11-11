import React from 'react';
import {createRoot,Root} from 'react-dom/client';
import DailyGreetingCard from '../../member/src/DailyGreetingCard';
let node:HTMLElement|undefined,root:Root|undefined;
function sync(){
 const explore=location.pathname.replace(/\/$/,'')==='/explore';
 if(!explore){if(root){root.unmount();root=undefined;}node?.remove();node=undefined;return;}
 if(node?.isConnected){
   if(node.nextElementSibling)node.parentElement?.append(node);
   return;
 }
 const main=document.querySelector('main');if(!main)return;
 if(root)root.unmount();
 node=document.createElement('div');node.id='ucell-greeting-overlay';main.append(node);
 root=createRoot(node);root.render(<DailyGreetingCard/>);
}
const style=document.createElement('link');style.rel='stylesheet';style.href='/greetings/style.css?v=social-logos';document.head.append(style);
let pending=false;new MutationObserver(()=>{if(!pending){pending=true;queueMicrotask(()=>{pending=false;sync()})}}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('popstate',sync);sync();
