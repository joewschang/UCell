import {describe,it,expect} from 'vitest';
import {act,create} from 'react-test-renderer';
import {RetentionTable,type Retention} from './AnalyticsRetentionPanel';
describe('fixed cohort retention presentation',()=>{
 const data:Retention={policyVersion:'test-v1',rows:[{cohortMonth:'2026-06',baselineAsOf:'2026-06-30T15:00:00Z',baselineSize:4,baselineActive:2,cells:[
 {age:0,observationMonth:'2026-06',status:'AVAILABLE',asOf:null,observed:4,missing:0,activeShare:.5,activeRetention:1},
 {age:1,observationMonth:'2026-07',status:'PARTIAL',asOf:null,observed:3,missing:1,activeShare:null,activeRetention:null}]}]};
 it('switches metric without substituting missing data with zero',()=>{
  const tree=create(<RetentionTable data={data}/>);let output=JSON.stringify(tree.toJSON());expect(output).toContain('50.0%');expect(output).toContain('部分成員無法追蹤');expect(output).toContain('缺少 1');
  act(()=>tree.root.findByType('select').props.onChange({target:{value:'activeRetention'}}));output=JSON.stringify(tree.toJSON());expect(output).toContain('100.0%');expect(output).toContain('分母為零時不計算');expect(output).not.toContain('50.0%');
 });
 it('provides a keyboard-scrollable table and explanatory labels',()=>{const tree=create(<RetentionTable data={data}/>);expect(tree.root.findByProps({role:'region'}).props.tabIndex).toBe(0);expect(tree.root.findAllByType('caption')[0].children.join('')).toContain('M0');});
});
