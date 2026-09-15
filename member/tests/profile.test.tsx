import React from 'react';
import {create,act,type ReactTestRenderer} from 'react-test-renderer';
import {it,expect,vi,afterEach} from 'vitest';
const update=vi.hoisted(()=>vi.fn());
vi.mock('../src/memberData',()=>({isMock:false,updateProfile:update}));
import ProfileEditor from '../src/ProfileEditor';
let tree:ReactTestRenderer;
afterEach(()=>{if(tree)act(()=>tree.unmount());update.mockReset();});
it('submits only edited contact fields, refreshes and clears submitted values',async()=>{
 update.mockResolvedValue({name:'Display'});const refresh=vi.fn();
 await act(async()=>{tree=create(<ProfileEditor refresh={refresh}/>);});
 act(()=>tree.root.findAllByType('input')[0].props.onChange({target:{value:' Display '}}));
 await act(async()=>{await tree.root.findByType('form').props.onSubmit({preventDefault(){}});});
 expect(update).toHaveBeenCalledWith({name:'Display'},expect.any(String));expect(refresh).toHaveBeenCalledTimes(1);
 expect(tree.root.findAllByType('input')[0].props.value).toBe('');
 expect(JSON.stringify(tree.toJSON())).toContain('會員資料已更新');
});
it('reuses the same idempotency key on retry of unchanged contact fields',async()=>{
 update.mockRejectedValueOnce(new Error('另一筆操作正在處理')).mockResolvedValueOnce({name:'Retry'});
 await act(async()=>{tree=create(<ProfileEditor refresh={()=>{}}/>);});
 act(()=>tree.root.findAllByType('input')[0].props.onChange({target:{value:'Retry'}}));
 for(let i=0;i<2;i++)await act(async()=>{await tree.root.findByType('form').props.onSubmit({preventDefault(){}});});
 expect(update).toHaveBeenCalledTimes(2);expect(update.mock.calls[0]).toEqual(update.mock.calls[1]);
 expect(JSON.stringify(tree.toJSON())).toContain('會員資料已更新');
});
it('keeps entered values when Backend rejects the update',async()=>{
 update.mockRejectedValue(new Error('登入已失效'));const refresh=vi.fn();
 await act(async()=>{tree=create(<ProfileEditor refresh={refresh}/>);});
 act(()=>tree.root.findAllByType('input')[1].props.onChange({target:{value:'test@example.invalid'}}));
 await act(async()=>{await tree.root.findByType('form').props.onSubmit({preventDefault(){}});});
 expect(refresh).not.toHaveBeenCalled();expect(tree.root.findAllByType('input')[1].props.value).toBe('test@example.invalid');
 expect(tree.root.findByProps({role:'alert'}).children).toEqual(['登入已失效']);
});
