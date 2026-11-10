export * from './context-ui.js';
export const page=document.querySelector('main');
export function show(...items){page.replaceChildren(...items);page.focus({preventScroll:true});window.scrollTo(0,0)}
document.querySelector('#large').onclick=e=>{e.currentTarget.setAttribute('aria-pressed',String(document.documentElement.classList.toggle('large')))};
