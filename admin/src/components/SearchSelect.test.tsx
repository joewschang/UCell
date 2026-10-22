import React from 'react';
import {act,create} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
import {SearchSelect} from './SearchSelect';
it('discards older search results after a newer query completes',async()=>{
 let resolve!:(value:any)=>void;const old=new Promise<any>(r=>resolve=r),search=vi.fn().mockReturnValueOnce(old).mockResolvedValueOnce([{id:'new',primary:'A000002'}]);
 let view!:ReturnType<typeof create>;await act(async()=>{view=create(<SearchSelect label="球號" search={search} onChange={()=>{}}/>)});
 let first!:Promise<void>;act(()=>{first=view.root.findByType('input').props.onChange({target:{value:'A'}})});
 await act(async()=>view.root.findByType('input').props.onChange({target:{value:'A000002'}}));
 await act(async()=>{resolve([{id:'old',primary:'A000001'}]);await first});
 const output=JSON.stringify(view.toJSON());expect(output).toContain('A000002');expect(output).not.toContain('A000001');act(()=>view.unmount());
});
it('shows an actionable error and clears loading on failed searches',async()=>{
 let view!:ReturnType<typeof create>;await act(async()=>{view=create(<SearchSelect label="球號" search={async()=>{throw Error('internal')}} onChange={()=>{}}/>)});
 await act(async()=>view.root.findByType('input').props.onChange({target:{value:'A'}}));const output=JSON.stringify(view.toJSON());expect(output).toContain('搜尋失敗');expect(output).not.toContain('internal');expect(output).not.toContain('搜尋中');act(()=>view.unmount());
});
