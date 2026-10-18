import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,expect,it,vi} from 'vitest';
import FormalSupplement from '../src/FormalSupplement';
import {uploadFormalDocument,submitFormalEnrollment} from '../src/memberData';
vi.mock('../src/useResource',()=>({useResource:()=>({data:{documents:[]},retry:vi.fn()})}));
vi.mock('../src/memberData',()=>({getFormalDocuments:vi.fn(),uploadFormalDocument:vi.fn(async()=>({})),submitFormalEnrollment:vi.fn(async()=>({}))}));
let tree:ReactTestRenderer;
afterEach(()=>{act(()=>tree?.unmount());vi.clearAllMocks();});
it('uploads selected replacements to original application and resubmits without rewriting personal data',async()=>{
 const done=vi.fn();act(()=>{tree=create(<FormalSupplement applicationId="ORIGINAL" onSubmitted={done}/>)});
 act(()=>tree.root.findAllByType('input')[2].props.onChange({target:{files:[{name:'bank.png'}]}}));
 await act(async()=>tree.root.findAllByType('button').at(-1)!.props.onClick());
 expect(uploadFormalDocument).toHaveBeenCalledWith('ORIGINAL','BANKBOOK_COVER',{name:'bank.png'});expect(submitFormalEnrollment).toHaveBeenCalledWith('ORIGINAL',expect.any(String));expect(done).toHaveBeenCalledOnce();
});
it('blocks resubmission on upload failure and retries only failed files',async()=>{
 vi.mocked(uploadFormalDocument).mockResolvedValueOnce({} as any).mockRejectedValueOnce(new Error('失敗')).mockResolvedValueOnce({} as any);
 act(()=>{tree=create(<FormalSupplement applicationId="ORIGINAL" onSubmitted={vi.fn()}/>)});
 act(()=>{const inputs=tree.root.findAllByType('input');inputs[0].props.onChange({target:{files:[{name:'front.png'}]}});inputs[1].props.onChange({target:{files:[{name:'back.png'}]}});});
 await act(async()=>tree.root.findAllByType('button').at(-1)!.props.onClick());expect(submitFormalEnrollment).not.toHaveBeenCalled();expect(JSON.stringify(tree.toJSON())).toContain('上傳未完成');
 await act(async()=>tree.root.findAllByType('button').at(-1)!.props.onClick());expect(uploadFormalDocument).toHaveBeenCalledTimes(3);expect(vi.mocked(uploadFormalDocument).mock.calls[2][1]).toBe('IDENTITY_BACK');expect(submitFormalEnrollment).toHaveBeenCalledOnce();
});
