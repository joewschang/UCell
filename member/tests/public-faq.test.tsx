import React from 'react';
import {act,create} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
import PublicFaq from '../src/PublicFaq';
it('loads current public FAQ without auth and filters categories and keywords',async()=>{
 const fetch=vi.fn(async()=>({ok:true,json:async()=>({data:{categories:[{id:'signup',label:'註冊'}],items:[{id:'one',category:'signup',question:'如何加入？',answer:'以手機或 Email 加入。',keywords:'註冊'}]}})}));vi.stubGlobal('fetch',fetch);
 let tree:any;try{await act(async()=>{tree=create(<PublicFaq/>)});expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/public/faq'),expect.objectContaining({cache:'no-store'}));expect(tree.root.findAllByType('details')).toHaveLength(1);act(()=>tree.root.findByType('input').props.onChange({target:{value:'找不到'}}));expect(tree.root.findAllByType('details')).toHaveLength(0);}finally{act(()=>tree?.unmount());vi.unstubAllGlobals()}
});
