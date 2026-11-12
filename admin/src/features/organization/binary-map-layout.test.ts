import {describe,expect,it} from 'vitest';
import {layoutTree,MapBall} from './binary-map-layout';
function nodes(...positions:string[]):MapBall[]{return positions.map(p=>({id:p,position:p,ballNo:'TW-'+p,name:'會員',active:true,plan:'STARTER'}))}
describe('full placement tree',()=>{
 it('keeps a single right or left child on its correct side',()=>{
   const {nodes:points,edges}=layoutTree(nodes('1','2','5','11'));
   expect(points[1].x).toBeLessThan(points[0].x);expect(points[2].x).toBeGreaterThan(points[1].x);
   expect(points[3].x).toBeGreaterThan(points[2].x);expect(edges).toHaveLength(3);
 });
 it('preserves deep positions without floating point rounding',()=>{
   const positions=Array.from({length:60},(_,i)=>(2n**BigInt(i)).toString());
   expect(layoutTree(nodes(...positions)).nodes.length).toBe(60);
 });
 it('rejects an incomplete map',()=>expect(()=>layoutTree(nodes('1','4'))).toThrow());
});