import {it,expect} from 'vitest';
import {create,act} from 'react-test-renderer';
import {PipelineDetail} from './BonusesPage';

const period='2026-09-01T00:00:00.000Z';
const rows=[
 {settlementBatchId:'batch-a',settlementType:'BINARY_K1',periodStart:'2026-08-01T00:00:00.000Z',periodEnd:period,ruleVersionCode:'RULE-A',status:'FINALIZED',totalTheory:'9137',calculationHash:'calculation-is-not-parameter'},
 {settlementBatchId:'batch-b',settlementType:'BINARY_K1',periodStart:'2026-08-15T00:00:00.000Z',periodEnd:period,ruleVersionCode:'RULE-B',status:'CALCULATED',totalTheory:'3141'},
];
it('requires explicit selection when two historical batches share period end and type',()=>{
 let tree:ReturnType<typeof create>;act(()=>{tree=create(<PipelineDetail stage="K1" period={period} rows={rows}/>)});
 expect(tree!.root.findByType('select').props.value).toBe('');
 expect(JSON.stringify(tree!.toJSON())).not.toContain('Core Settlement Record');
 act(()=>tree!.root.findByType('select').props.onChange({target:{value:'batch-b'}}));
 const detail=JSON.stringify(tree!.toJSON());expect(detail).toContain('RULE-B');expect(detail).toContain('3141');expect(detail).not.toContain('9137');
 act(()=>tree!.unmount());
});
it('does not substitute theory or calculation hash for unavailable output/parameter evidence',()=>{
 let tree:ReturnType<typeof create>;act(()=>{tree=create(<PipelineDetail stage="K1" period={period} rows={[rows[0]]}/>)});
 const values=tree!.root.findByType('dl').findAllByType('dd').map(n=>n.children.join(''));
 expect(values[1]).toBe('RULE-A');expect(values[2]).toBe('unavailable');expect(values[4]).toBe('unavailable');
 act(()=>tree!.unmount());
});
