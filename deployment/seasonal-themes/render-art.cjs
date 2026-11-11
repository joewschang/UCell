// Render the same seasonal illustrations for the member app and LINE's four touch areas.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright-core');
function render({theme,menu}) {
  const colors={
    christmas:['#0c2621','#16483c','#e1bc77','#91b59b','#bd4f48'],
    newyear:['#101c3c','#283958','#ebbe78','#83bbc8','#d89583'],
    lunar:['#511d27','#872f30','#f1c77d','#db936b','#bc4f3b']
  }[theme];
  const [deep,base,gold,pale,accent]=colors;
  const c=document.createElement('canvas');c.width=1280;c.height=menu?864:392;
  const g=c.getContext('2d');
  let seed=7743;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function line(x,y,u,v,color,w=1){g.beginPath();g.moveTo(x,y);g.lineTo(u,v);g.strokeStyle=color;g.lineWidth=w;g.stroke();}
  function circle(x,y,r,color){g.beginPath();g.arc(x,y,r,0,2*Math.PI);g.fillStyle=color;g.fill();}
  function ellipse(x,y,rx,ry,a,color){g.beginPath();g.ellipse(x,y,rx,ry,a,0,2*Math.PI);g.fillStyle=color;g.fill();}
  function star(x,y,r){g.fillStyle=gold;g.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rr=i%2?r*.21:r;g.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}g.closePath();g.fill();}
  function pine(x,y,a,len){
    const dx=Math.cos(a),dy=Math.sin(a);line(x,y,x+dx*len,y+dy*len,gold,1.6);
    for(let n=0;n<len;n+=3.8){const scale=(1-n/len)*27+6;for(const side of [-1,1]){
      const theta=a+side*(.55+random()*.4),size=scale*(.75+random()*.5);
      line(x+dx*n,y+dy*n,x+dx*n+Math.cos(theta)*size,y+dy*n+Math.sin(theta)*size,random()<.34?'#b1b889':'#71977c',1.7);}}
  }
  function ornament(x,y,r,color){line(x,-42,x,y-r,gold);g.fillStyle=gold;g.fillRect(x-6,y-r-5,12,9);circle(x,y,r,color);
    g.save();g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.clip();for(let i=-2;i<=2;i++){g.beginPath();g.ellipse(x+i*9,y,Math.max(3,r*.52),r*1.15,-.3,0,Math.PI*2);g.strokeStyle='#dfc891';g.lineWidth=1;g.stroke();}g.restore();}
  function firework(x,y,r,n,color){for(let i=0;i<n;i++){const a=i*Math.PI*2/n,dist=r*(.72+random()*.28);
    line(x+Math.cos(a)*dist*.17,y+Math.sin(a)*dist*.17,x+Math.cos(a)*dist*.72,y+Math.sin(a)*dist*.72,color,1.5);
    line(x+Math.cos(a)*dist*.8,y+Math.sin(a)*dist*.8,x+Math.cos(a)*dist,y+Math.sin(a)*dist,color,2);circle(x+Math.cos(a)*(dist+6),y+Math.sin(a)*(dist+6),1.6,pale);}
    star(x,y,6);}
  function lantern(x,y,r){line(x,-50,x,y-r,gold,1.5);ellipse(x,y,r,r*.86,0,accent);
    g.strokeStyle=gold;g.lineWidth=1.5;for(const k of [.31,.68,.96]){g.beginPath();g.ellipse(x,y,k*r,r*.86,0,0,2*Math.PI);g.stroke();}
    g.fillStyle=gold;g.fillRect(x-r*.32,y-r*.88,r*.64,5);g.fillRect(x-r*.32,y+r*.80,r*.64,5);
    line(x,y+r*.87,x,y+r+15,gold,1.5);for(let k=-3;k<4;k++)line(x+k,y+r+16,x+k*1.45,y+r+34,gold);}
  function blossom(x,y,s){for(let j=0;j<5;j++){const a=j*2*Math.PI/5;ellipse(x+Math.cos(a)*s*.52,y+Math.sin(a)*s*.52,s*.58,s*.37,a,'#e5ac8d');}circle(x,y,s*.19,gold);}
  function illustration(x,y,scale){
    g.save();g.translate(x,y);g.scale(scale,scale);
    if(theme==='christmas'){
      for(let j=0;j<9;j++)pine(137-j*21,-16+j*5,1.55+j*.105,136-j*4);
      for(let j=0;j<6;j++)pine(177-j*5,161+j*15,2.68-j*.08,122-j*7);
      ornament(-64,117,26,accent);ornament(5,171,19,'#c2a15e');star(-122,63,11);
    }else if(theme==='newyear'){firework(27,87,91,44,gold);firework(-95,161,48,27,pale);firework(127,210,57,29,accent);star(-79,43,8);}
    else{lantern(37,74,48);lantern(119,129,31);line(-130,209,17,146,gold,2);for(let j=0;j<8;j++){const x=-121+j*18,y=204-j*7;line(x,y,x+7,y-18,gold);blossom(x+7,y-18,5+j%3);}star(-57,94,8);}
    g.restore();
  }
  function icon(type,x,y){g.save();g.translate(x,y);g.strokeStyle=gold;g.lineWidth=3;g.lineCap='round';g.lineJoin='round';g.beginPath();
    if(type===0){g.arc(0,-8,8,0,2*Math.PI);g.moveTo(-16,15);g.bezierCurveTo(-15,-1,15,-1,16,15);}
    if(type===1){g.roundRect(-16,-14,32,30,4);g.moveTo(-16,-3);g.lineTo(16,-3);line(-8,-19,-8,-9,gold,3);line(8,-19,8,-9,gold,3);}
    if(type===2){g.moveTo(-14,-4);g.lineTo(-16,16);g.lineTo(16,16);g.lineTo(14,-4);g.closePath();g.moveTo(-7,-3);g.bezierCurveTo(-8,-20,8,-20,7,-3);}
    if(type===3){g.moveTo(-15,9);g.bezierCurveTo(-30,-23,29,-26,18,4);g.quadraticCurveTo(10,15,-5,13);g.lineTo(-17,19);g.closePath();}
    g.stroke();g.restore();}
  function backdrop(x,y,w,h){const grad=g.createLinearGradient(x,y,x+w,y+h);grad.addColorStop(0,deep);grad.addColorStop(1,base);g.fillStyle=grad;g.fillRect(x,y,w,h);
    for(let i=0;i<110;i++){g.globalAlpha=.2+random()*.45;circle(x+random()*w,y+random()*h,random()*1.2+.3,gold);}g.globalAlpha=1;}
  if(menu){
    const labels=['會員中心','活動報名','線上商城','常見問答'],english=['MEMBER CENTER','EVENTS','SHOP','HELP CENTER'];
    for(let i=0;i<4;i++){const x=i%2*640,y=i<2?0:392,h=i<2?392:398;
      g.save();g.beginPath();g.rect(x,y,640,h);g.clip();backdrop(x,y,640,h);illustration(x+483,y+2,1.12);
      icon(i,x+65,y+81);
      g.fillStyle='#fff4df';g.font='bold 58px "Microsoft JhengHei"';g.fillText(labels[i],x+42,y+251);
      g.fillStyle=gold;g.font='500 18px Arial';g.letterSpacing='3px';g.fillText(english[i],x+45,y+300);g.letterSpacing='0px';
      line(x+48,y+325,x+109,y+325,gold,2);g.restore();
    }
    line(640,0,640,790,gold);line(0,392,1280,392,gold);backdrop(0,790,1280,74);
    g.fillStyle=gold;g.font='bold 28px Georgia';g.fillText('UCell',39,837);
    g.font='22px "Microsoft JhengHei"';g.textAlign='right';g.fillText({christmas:'聖誕 · 松林星夜',newyear:'新年 · 跨年煙火',lunar:'中國年 · 燈映春梅'}[theme],1240,837);
  }else{backdrop(0,0,1280,392);illustration(1040,0,1.64);illustration(505,-88,.88);}
  return c.toDataURL('image/jpeg',.90).split(',')[1];
}
(async()=>{const out=path.join(__dirname,'art');fs.mkdirSync(out,{recursive:true});const b=await chromium.launch({executablePath:process.env.CHROME});try{const p=await b.newPage();for(const theme of ['christmas','newyear','lunar'])for(const menu of [false]){
  const bytes=Buffer.from(await p.evaluate(render,{theme,menu}),'base64');if(menu&&bytes.length>1000000)throw Error('Menu exceeds LINE image limit');fs.writeFileSync(path.join(out,(menu?'menu-':'banner-')+theme+'.jpg'),bytes);}}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
