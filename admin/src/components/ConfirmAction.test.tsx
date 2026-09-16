import {it,expect,vi} from 'vitest';
import {create,act} from 'react-test-renderer';
import {ConfirmAction} from './ConfirmAction';
vi.mock('../features/auth/auth',()=>({useAuth:()=>({user:{role:'FINANCE'}})}));
it('does not execute a governed action before explicit reason confirmation',async()=>{const action=vi.fn(),reason={value:''};let tree:ReturnType<typeof create>;act(()=>{tree=create(<ConfirmAction onConfirm={action}>Mark PAID</ConfirmAction>,{createNodeMock:node=>node.type==='input'?reason:{showModal:vi.fn(),close:vi.fn(),open:false}})});act(()=>tree!.root.findAllByType('button')[0].props.onClick());expect(action).not.toHaveBeenCalled();reason.value='approved evidence';await act(async()=>{tree!.root.findByType('form').props.onSubmit({preventDefault:vi.fn()})});expect(action).toHaveBeenCalledWith('approved evidence');act(()=>tree!.unmount())});
