import {describe,it,expect} from 'vitest';
import {create} from 'react-test-renderer';
import {NaslOverview,NaslTrend,trendSegments,type NaslSnapshot} from './NaslOverview';
const row=(asOf:string,policyVersion='v1',value=0):NaslSnapshot=>({asOf,policyVersion,counts:{N:value,A:0,S:0,L:0}});
describe('NASL visual evidence',()=>{
 it('breaks missing dates and policy versions without removing actual zeros',()=>{
  const rows=[row('2026-09-10T00:00:00Z','v2',4),row('2026-09-06T00:00:00Z'),row('2026-09-07T00:00:00Z','v1',2),row('2026-09-09T00:00:00Z','v1',3)];
  expect(trendSegments(rows,'N').map(s=>s.map(p=>p.value))).toEqual([[0,2],[3],[4]]);
 });
 it('uses Taipei calendar dates even when captures are less than 24 hours apart',()=>{
  expect(trendSegments([row('2026-09-06T15:59:00Z'),row('2026-09-06T16:01:00Z')],'N')).toHaveLength(1);
 });
 it('renders no fictitious flow or percentage for an empty first snapshot',()=>{
  const tree=create(<NaslOverview counts={{N:0,A:0,S:0,L:0}} total={0}/>);
  const output=JSON.stringify(tree.toJSON());expect(output).toContain('累積兩次');expect(output).not.toContain('NaN');expect(output).not.toContain('Infinity');expect(tree.root.findAllByType('dd')).toHaveLength(0);
 });
 it('renders only the supplied snapshot flow counts, with the comparison period',()=>{
  const tree=create(<NaslOverview counts={{N:3,A:5,S:1,L:1}} total={10} asOf="2026-09-18T00:00:00Z" comparisonAsOf="2026-09-17T00:00:00Z" matrix={{'N->A':2,'S->A':1}} newEntrants={3}/>);
  expect(tree.root.findAllByType('dd').map(n=>n.children.join(''))).toEqual(['2','0','1','0','0']);expect(JSON.stringify(tree.toJSON())).toContain('兩次快照間變化');
 });
 it('does not draw a line across a missing observation',()=>{
  const tree=create(<NaslTrend rows={[row('2026-09-06T00:00:00Z'),row('2026-09-08T00:00:00Z')]}/>);
  expect(tree.root.findAllByType('polyline')).toHaveLength(0);expect(tree.root.findAllByType('circle')).toHaveLength(8);
 });
});
