import {it,expect} from 'vitest';
import {create,act} from 'react-test-renderer';
import {AdminDataGrid} from './AdminDataGrid';
const rows=Array.from({length:25},(_,i)=>({id:String(i),name:`會員${i}`}));
const columns=[{key:'name',label:'姓名',value:(r:typeof rows[number])=>r.name},{key:'id',label:'ID',value:(r:typeof rows[number])=>r.id}];
it('paginates only the explicit loaded result and disables boundary commands',()=>{
 let tree:ReturnType<typeof create>;act(()=>{tree=create(<AdminDataGrid rows={rows} columns={columns} rowId={r=>r.id} label="測試名冊"/>)});
 expect(tree!.root.findByType('tbody').findAllByType('tr')).toHaveLength(20);
 const button=(name:string)=>tree!.root.findAllByType('button').find(b=>b.children.join('')===name)!;
 expect(button('上一頁').props.disabled).toBe(true);act(()=>button('下一頁').props.onClick());expect(tree!.root.findByType('tbody').findAllByType('tr')).toHaveLength(5);expect(button('下一頁').props.disabled).toBe(true);expect(JSON.stringify(tree!.toJSON())).toContain('本次載入');act(()=>tree!.unmount());
});
it('sorts with numeric text and exposes direction to assistive technology',()=>{
 let tree:ReturnType<typeof create>;act(()=>{tree=create(<AdminDataGrid rows={rows} columns={columns} rowId={r=>r.id} label="測試名冊"/>)});
 const button=()=>tree!.root.findAllByType('button').find(b=>b.children.join('')==='ID')!;
 act(()=>button().props.onClick());expect(tree!.root.findAllByType('th')[1].props['aria-sort']).toBe('ascending');expect(tree!.root.findByType('tbody').findAllByType('tr')[0].findAllByType('td')[1].children).toEqual(['0']);
 act(()=>button().props.onClick());expect(tree!.root.findAllByType('th')[1].props['aria-sort']).toBe('descending');expect(tree!.root.findByType('tbody').findAllByType('tr')[0].findAllByType('td')[1].children).toEqual(['24']);act(()=>tree!.unmount());
});
it('keeps at least one visible column and distinguishes empty data',()=>{
 let tree:ReturnType<typeof create>;act(()=>{tree=create(<AdminDataGrid rows={[]} columns={columns} rowId={r=>r.id} label="測試名冊"/>)});
 expect(JSON.stringify(tree!.toJSON())).toContain('目前沒有資料');act(()=>tree!.root.findAllByType('input')[0].props.onChange());act(()=>tree!.root.findAllByType('input')[1].props.onChange());expect(tree!.root.findAllByType('input').filter(i=>i.props.checked)).toHaveLength(1);act(()=>tree!.unmount());
});
