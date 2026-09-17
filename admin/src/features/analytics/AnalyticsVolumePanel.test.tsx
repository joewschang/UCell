import {describe,it,expect} from 'vitest';
import {create,act} from 'react-test-renderer';
import {VolumeEvidence,type VolumeReport} from './AnalyticsVolumePanel';
const amount={original:'100.1234',adjustment:'-20.0000',net:'80.1234',events:1};
describe('Historical volume evidence',()=>{
 it('displays exact decimal strings and separates volume types',()=>{
  const data:VolumeReport={status:'AVAILABLE',volumes:['GPV','RPV','EPV'].map(type=>({type,unit:type,total:amount,left:null,right:null,generations:[{generation:1,...amount}]}))};
  const tree=create(<VolumeEvidence data={data}/>);expect(JSON.stringify(tree.toJSON())).toContain('100.1234');expect(JSON.stringify(tree.toJSON())).toContain('不能相加');
  act(()=>tree.root.findByType('select').props.onChange({target:{value:'EPV'}}));expect(tree.root.findByType('meter').props['aria-label']).toContain('EPV');
 });
 it('does not display fabricated zero totals when historical evidence is unavailable',()=>{const tree=create(<VolumeEvidence data={{status:'UNAVAILABLE',reason:'HISTORICAL_VOLUME_EVIDENCE_INCOMPLETE'}}/>);expect(tree.root.findAllByType('meter')).toHaveLength(0);expect(JSON.stringify(tree.toJSON())).toContain('暫不提供');expect(JSON.stringify(tree.toJSON())).not.toContain('0.0000');});
 it('shows carry correction and freshness separately from period flow',()=>{const tree=create(<VolumeEvidence data={{status:'AVAILABLE',freshness:'STALE',asOf:'2026-09-01T00:00:00Z',carry:{status:'AVAILABLE',basis:'LATEST_REPLAY_CORRECTION',left:'60.0000',right:'0.0000',originalLeft:'80.0000',originalRight:'0.0000'}}}/>);const out=JSON.stringify(tree.toJSON());expect(out).toContain('已採最新重算修正');expect(out).toContain('不能與近 30 天流量相加');expect(out).toContain('快照已過期');});
});
