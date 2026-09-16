import {it,expect,vi} from 'vitest';
import {create,act} from 'react-test-renderer';
import {AdminTable} from './AdminTable';
it('rolls a legacy table into the approved bounded grid without changing rendered facts',()=>{const open=vi.fn();let tree:ReturnType<typeof create>;act(()=>{tree=create(<AdminTable><thead><tr><th>Status</th><th>Amount</th></tr></thead><tbody><tr onClick={open}><td>PAID</td><td>NT$ 1,680</td></tr></tbody></AdminTable>)});expect(JSON.stringify(tree!.toJSON())).toContain('僅對本次 API 回傳資料');expect(JSON.stringify(tree!.toJSON())).toContain('NT$ 1,680');act(()=>tree!.root.findAllByType('button').find(b=>b.children.join('')==='查看')!.props.onClick({stopPropagation:vi.fn()}));expect(open).toHaveBeenCalledOnce();act(()=>tree!.unmount())});
