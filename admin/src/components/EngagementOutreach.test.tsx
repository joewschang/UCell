import {act,create} from 'react-test-renderer';
import {it,expect,vi} from 'vitest';
import {EngagementOutreach} from './EngagementOutreach';
it('uses public member number and fixed outreach action without accepting message content or destination',async()=>{
 const command=vi.fn().mockResolvedValue(true);let tree:any;await act(async()=>{tree=create(<EngagementOutreach path="/admin/learning/courses/COURSE/outreach" learning busy={false} command={command}/>);});
 const inputs=tree.root.findAllByType('input');await act(async()=>{inputs[0].props.onChange({target:{value:'1234567890'}});inputs[1].props.onChange({target:{value:'個別指派'}});tree.root.findByType('select').props.onChange({target:{value:'ASSIGN'}});});
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));expect(command).toHaveBeenCalledWith('/admin/learning/courses/COURSE/outreach',{memberNo:'1234567890',reason:'個別指派',action:'ASSIGN'});expect(JSON.stringify(tree.toJSON())).toContain('只送至該會員的 UCell 個人訊息中心');await act(async()=>tree.unmount());
});
