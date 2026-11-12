export type MapBall={id:string;ballNo:string;name:string;position:string;plan:string|null;active:boolean};
export const column=192, row=140;
export function layoutTree(balls:MapBall[]){
  const byPosition=new Map(balls.map(b=>[BigInt(b.position),b]));
  const widths=new Map<bigint,number>();
  function measure(p:bigint):number{
    if(!byPosition.has(p))return 0;
    const left=measure(p*2n),right=measure(p*2n+1n);
    const width=left||right?Math.max(1,left)+Math.max(1,right):1;
    widths.set(p,width);return width;
  }
  const width=measure(1n)*column;
  if(widths.size!==balls.length)throw Error('組織位置不完整，請重新整理後核對。');
  const nodes:{ball:MapBall;x:number;y:number}[]=[],edges:{x:number;y:number;cx:number;cy:number}[]=[];
  function place(p:bigint,start:number,depth:number,parent?:{x:number;y:number}){
    const ball=byPosition.get(p);if(!ball)return;
    const x=start+widths.get(p)!*column/2,y=depth*row+16;
    nodes.push({ball,x,y});
    if(parent)edges.push({...parent,cx:x,cy:y});
    place(p*2n,start,depth+1,{x,y});
    place(p*2n+1n,start+(widths.get(p*2n)??1)*column,depth+1,{x,y});
  }
  place(1n,0,0);
  return {width,height:nodes.reduce((h,n)=>Math.max(h,n.y+row),0),nodes,edges};
}