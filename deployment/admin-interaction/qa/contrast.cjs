// Measure rendered foreground against solid surfaces and bounding colors of opaque two-stop gradients.
function readText(root) {
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});canvas.width=canvas.height=1;
  const colors=new Map();
  function rgb(color){
    if(!colors.has(color)){ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);colors.set(color,[...ctx.getImageData(0,0,1,1).data]);}
    return colors.get(color);
  }
  const over=(ink,base,alpha=ink[3]/255)=>[0,1,2].map(i=>ink[i]*alpha+base[i]*(1-alpha));
  const lum=c=>c.reduce((sum,x,i)=>{const n=x/255;return sum+[.2126,.7152,.0722][i]*(n<=.04045?n/12.92:((n+.055)/1.055)**2.4);},0);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const found=[];let text;
  while((text=walker.nextNode())){
    const label=text.textContent.trim(),el=text.parentElement;if(!label||!el||el.closest('[aria-hidden=true],svg,script,style')||!el.getClientRects().length)continue;
    const ancestors=[];let complex=false,invisible=false;
    for(let p=el;p;p=p.parentElement){const css=getComputedStyle(p);if(css.visibility!=='visible'||Number(css.opacity)===0){invisible=true;break;}ancestors.push(css);if(rgb(css.backgroundColor)[3]===255)break;}
    if(invisible)continue;
    let low=[255,255,255],high=[255,255,255];
    for(const surface of ancestors.reverse()){
      const fill=rgb(surface.backgroundColor);low=over(fill,low);high=over(fill,high);
      if(Number(surface.opacity)<1)complex=true;
      if(surface.backgroundImage==='none')continue;
      const stops=/^linear-gradient\((?:[-.\d]+deg, )?(rgb\([\d, .]+\)), (rgb\([\d, .]+\))\)$/.exec(surface.backgroundImage);
      if(!stops){complex=true;continue;}
      const start=rgb(stops[1]),end=rgb(stops[2]);
      low=[0,1,2].map(i=>Math.min(start[i],end[i]));high=[0,1,2].map(i=>Math.max(start[i],end[i]));
    }
    const css=getComputedStyle(el),color=css.webkitTextFillColor||css.color,ink=rgb(color);
    if(ink[3]!==255&&low.some((n,i)=>n!==high[i]))complex=true;
    const ratioFor=background=>{const fore=lum(over(ink,background)),back=lum(background);return (Math.max(fore,back)+.05)/(Math.min(fore,back)+.05);};
    const bg=ratioFor(low)<ratioFor(high)?low:high;
    const ratio=lum(low)<lum(ink)&&lum(ink)<lum(high)?1:ratioFor(bg);
    const font=parseFloat(css.fontSize),weight=Number(css.fontWeight)||400;
    const limit=(font>=24||font>=18.66&&weight>=700)?3:4.5;
    found.push({label:label.slice(0,52),ratio:+ratio.toFixed(2),limit,foreground:color,background:bg.map(Math.round).join(','),complex,pass:complex||ratio+.002>=limit});
  }
  return found;
}
module.exports={readText};
