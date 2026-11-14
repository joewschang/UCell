export function rect(left=0,top=0,right=1,bottom=1) {
  return [{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}];
}
// Compare the photo margins with the interior. Keep the full image unless
// the candidate has a large, mostly continuous foreground on all four sides.
export function estimate(image,width,height) {
  const rgb=(x,y,c)=>image[(y*width+x)*4+c];
  const margins=[[],[],[]];
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    if(x>1&&x<width-2&&y>1&&y<height-2) continue;
    margins.forEach((list,c)=>list.push(rgb(x,y,c)));
  }
  const median=a=>a.sort((x,y)=>x-y)[a.length>>1];
  const bg=margins.map(median);
  const spread=Math.max(...margins.map((list,c)=>median(list.map(v=>Math.abs(v-bg[c])))));
  if(spread>30)return rect();
  const rows=new Uint16Array(height),cols=new Uint16Array(width);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(bg.some((v,c)=>Math.abs(rgb(x,y,c)-v)>Math.max(34,spread*4))){rows[y]++;cols[x]++;}
  }
  const bounds=(counts,min)=>[counts.findIndex(n=>n>=min),counts.findLastIndex(n=>n>=min)];
  const [l,r]=bounds(cols,height*.28),[t,b]=bounds(rows,width*.28);
  if((r-l)*(b-t)<width*height*.26||r<=l||b<=t)return rect();
  if(rows.slice(t,b).some(n=>n<(r-l)*.55)||cols.slice(l,r).some(n=>n<(b-t)*.55))return rect();
  return rect(Math.max(0,l/width-.025),Math.max(0,t/height-.025),Math.min(1,(r+1)/width+.025),Math.min(1,(b+1)/height+.025));
}
export async function detect(file) {
  const img=await createImageBitmap(file);
  try {
    const canvas=document.createElement('canvas'),scale=Math.min(1,160/Math.max(img.width,img.height));
    canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return estimate(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);
  } finally {img.close();}
}
export async function sidewaysText(file,points) {
  const bitmap=await createImageBitmap(file);
  try {
    const canvas=document.createElement('canvas');
    const w=(points[2].x-points[0].x)*bitmap.width,h=(points[2].y-points[0].y)*bitmap.height;
    const scale=Math.min(1,400/Math.max(w,h));
    canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
    const ctx=canvas.getContext('2d');
    ctx.drawImage(bitmap,points[0].x*bitmap.width,points[0].y*bitmap.height,w,h,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const rows=new Float32Array(canvas.height),cols=new Float32Array(canvas.width);
    for(let y=0;y<rows.length;y++)for(let x=0;x<cols.length;x++){
      const i=(y*cols.length+x)*4;
      if((pixels[i]+pixels[i+1]+pixels[i+2])/3<105){rows[y]+=1/cols.length;cols[x]+=1/rows.length;}
    }
    const variation=arr=>arr.reduce((sum,v,i)=>sum+(i?Math.abs(v-arr[i-1]):0),0)/arr.length;
    const vertical=variation(cols);
    return vertical>.017 && vertical>variation(rows)*2;
  } finally {bitmap.close();}
}
export function cropControls(jsx,points,update,disabled) {
  const [a,,b]=points, cx=(a.x+b.x)/2, cy=(a.y+b.y)/2;
  const handles=[['左上',a.x,a.y],['上',cx,a.y],['右上',b.x,a.y],['右',b.x,cy],['右下',b.x,b.y],['下',cx,b.y],['左下',a.x,b.y],['左',a.x,cy]];
  const move=(label,x,y)=>{
    const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
    update(rect(label.includes('左')?clamp(x,0,b.x-.08):a.x,label.includes('上')?clamp(y,0,b.y-.08):a.y,label.includes('右')?clamp(x,a.x+.08,1):b.x,label.includes('下')?clamp(y,a.y+.08,1):b.y));
  };
  return jsx('div',{className:'uc-crop-layer',children:[
    jsx('div',{className:'uc-crop-outline',style:{left:a.x*100+'%',top:a.y*100+'%',width:(b.x-a.x)*100+'%',height:(b.y-a.y)*100+'%'}},'outline'),
    ...handles.map(([label,x,y])=>jsx('button',{type:'button',className:'uc-crop-handle'+(label.length===1?' uc-crop-edge':''),'aria-label':'調整裁切框'+label,disabled,
      style:{left:x*100+'%',top:y*100+'%',...(label==='上'||label==='下'?{width:'calc('+(b.x-a.x)*100+'% - 28px)'}:label==='左'||label==='右'?{height:'calc('+(b.y-a.y)*100+'% - 28px)'}:{})},onPointerDown:e=>{e.currentTarget.setPointerCapture(e.pointerId);},
      onPointerMove:e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const area=e.currentTarget.parentElement.getBoundingClientRect();move(label,(e.clientX-area.left)/area.width,(e.clientY-area.top)/area.height);},
      onKeyDown:e=>{const shift={ArrowLeft:[-.01,0],ArrowRight:[.01,0],ArrowUp:[0,-.01],ArrowDown:[0,.01]}[e.key];if(shift){e.preventDefault();move(label,x+shift[0],y+shift[1]);}}
    },label))]});
}

