export type SponsorBall = {
  id:string; parentId:string|null; ballNo:string|null; name:string|null;
  plan:string|null; active:boolean|null; sponsorSequenceNo:number|null; createdAt:string;
};
export const cardWidth=156, cardHeight=108;
const margin=22, horizontalGap=22, verticalGap=48;

export function sponsorForest(balls:SponsorBall[]) {
  const byId=new Map<string,SponsorBall>(), children=new Map<string,SponsorBall[]>(), roots:SponsorBall[]=[];
  for(const ball of balls) {
    if(!ball?.id || byId.has(ball.id)) throw Error('推薦球或推薦關係重複');
    byId.set(ball.id,ball);
    children.set(ball.id,[]);
  }
  for(const ball of balls) {
    if(ball.parentId===null) roots.push(ball);
    else {
      const siblings=children.get(ball.parentId);
      if(!siblings) throw Error('缺少上層推薦球');
      siblings.push(ball);
    }
  }
  const compare=(l:SponsorBall,r:SponsorBall)=>
    (l.sponsorSequenceNo??Infinity)-(r.sponsorSequenceNo??Infinity) || l.createdAt.localeCompare(r.createdAt) || l.id.localeCompare(r.id);
  roots.sort(compare);
  for(const siblings of children.values()) siblings.sort(compare);
  const pending=roots.slice();
  let reached=0;
  while(pending.length){
    const ball=pending.pop()!;
    reached++;
    for(const child of children.get(ball.id)!) pending.push(child);
  }
  if(reached!==balls.length) throw Error('推薦關係有循環');
  return {byId,children,roots};
}

export type SponsorNode={ball:SponsorBall;x:number;y:number;depth:number;direct:number};
export function sponsorLayout(forest:ReturnType<typeof sponsorForest>,focus:string|null) {
  const roots=focus?[forest.byId.get(focus)].filter((ball):ball is SponsorBall=>!!ball):forest.roots;
  const order:SponsorNode[]=[],stack=roots.slice().reverse().map(ball=>({ball,depth:0}));
  let levels=0;
  while(stack.length) {
    const {ball,depth}=stack.pop()!;
    const children=forest.children.get(ball.id)!;
    order.push({ball,x:0,y:margin+depth*(cardHeight+verticalGap),depth,direct:children.length});
    levels=Math.max(levels,depth+1);
    for(let i=children.length-1;i>=0;i--) stack.push({ball:children[i],depth:depth+1});
  }
  const positions=new Map(order.map(node=>[node.ball.id,node] as const));
  let leafX=margin;
  for(const node of order) if(!node.direct){node.x=leafX;leafX+=cardWidth+horizontalGap;}
  for(let i=order.length-1;i>=0;i--) {
    const node=order[i], children=forest.children.get(node.ball.id)!;
    if(children.length) node.x=(positions.get(children[0].id)!.x+positions.get(children[children.length-1].id)!.x)/2;
  }
  // A trunk per family and one short drop per child, regardless of the number of siblings.
  const lines:string[]=[];
  for(const node of order) {
    if(!node.direct)continue;
    const children=forest.children.get(node.ball.id)!,middleY=node.y+cardHeight+verticalGap/2;
    const first=positions.get(children[0].id)!, last=positions.get(children[children.length-1].id)!;
    lines.push(`M${node.x+cardWidth/2},${node.y+cardHeight}V${middleY}M${first.x+cardWidth/2},${middleY}H${last.x+cardWidth/2}`);
    for(const child of children) {
      const position=positions.get(child.id)!;
      lines.push(`M${position.x+cardWidth/2},${middleY}V${position.y}`);
    }
  }
  return {order,positions,edges:lines.join(''),levels,rootCount:roots.length,
    width:Math.max(2*margin+cardWidth,leafX-horizontalGap+margin),
    height:Math.max(2*margin+cardHeight,2*margin+levels*(cardHeight+verticalGap)-verticalGap)};
}
