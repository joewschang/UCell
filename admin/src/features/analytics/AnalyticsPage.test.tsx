import {describe,expect,it,vi} from 'vitest';
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:'SUPER_ADMIN'}})}));
import {create} from 'react-test-renderer';
import {Radar,percent} from './AnalyticsPage';
describe('Analytics evidence display',()=>{
  it('preserves a true zero versus missing denominator',()=>{expect(percent(0)).toBe('0.0%');expect(percent(null)).toBe('—');});
  it('renders all 12 generation labels and only evidence-backed data points',()=>{
    const rows=Array.from({length:12},(_,i)=>({generation:i+1,qualificationCount:0,systemCount:0,personCount:0,activeCount:0,activeRate:i===0?.5:null,repurchaseRate:null,newRate:null,riskRate:null,heat:{label:'UNAVAILABLE',reason:''}}));
    const tree=create(<Radar rows={rows}/>);expect(tree.root.findAllByType('circle')).toHaveLength(1);expect(tree.root.findAllByType('rect')).toHaveLength(0);
    const output=JSON.stringify(tree.toJSON());expect(output).toContain('12');expect(output).toContain('缺值不繪點');
  });
});
