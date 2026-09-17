import React from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {act,create} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {get} from '../../lib/api';
import {UatPage} from './UatPage';

vi.mock('../../lib/api',()=>({get:vi.fn(),qs:(values:Record<string,string|undefined>)=>{const query=new URLSearchParams(Object.entries(values).filter((entry):entry is [string,string]=>!!entry[1]));return query.size?`?${query}`:''}}));
beforeEach(()=>{
  vi.stubGlobal('localStorage',{
    getItem:vi.fn(()=>null),
    setItem:vi.fn()
  });
  vi.mocked(get).mockReset();
  vi.mocked(get).mockResolvedValue({data:[]});
});

async function render(){
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  let tree:ReturnType<typeof create>;
  await act(async()=>{tree=create(<QueryClientProvider client={client}><UatPage/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,20));});
  return tree!;
}

it('labels every browser-local UAT result and export as non-formal evidence',async()=>{
  const tree=await render();const output=JSON.stringify(tree.toJSON());
  expect(output).toContain('LOCAL_ASSISTIVE_ONLY');
  expect(output).toContain('localStorage');
  expect(output).toContain('不得作為 UAT 簽核、Release Gate PASS 或 Production Promotion 依據');
  expect(output).toContain('匯出本機輔助 JSON（非簽核）');
  expect(output).not.toContain('R6正式UAT執行清單');
  act(()=>tree.unmount());
});

it('reads and renders governed evidence without treating it as formal sign-off',async()=>{
  vi.mocked(get).mockResolvedValue({data:[{uatExecutionEvidenceId:'evidence-1',classification:'FORMAL_UAT_EVIDENCE',environment:'UAT',scenarioCode:'UAT-R6-013',result:'PASS',evidenceHash:'a'.repeat(64),artifactReference:'artifact://uat/auth/result.json',approvalReference:'CAB-42',actorId:'actor-1',executedAt:'2026-09-18T01:00:00.000Z',recordedAt:'2026-09-18T01:01:00.000Z',formalSignOff:false}]});
  const tree=await render();const output=JSON.stringify(tree.toJSON());
  expect(get).toHaveBeenCalledWith('/admin/uat-evidence');
  expect(output).toContain('受治理的 UAT Evidence（唯讀）');expect(output).toContain('FORMAL_UAT_EVIDENCE');expect(output).toContain('UAT-R6-013');expect(output).toContain('artifact://uat/auth/result.json');expect(output).toContain('a'.repeat(64));expect(output).toContain('formalSignOff: ');expect(output).toContain('false');expect(output).toContain('與上方瀏覽器 localStorage 輔助結果及統計完全分離');
  act(()=>tree.unmount());
});

it('shows empty, loading, and error feedback for the governed evidence query',async()=>{
  let resolveRequest:(value:{data:never[]})=>void=()=>undefined;
  vi.mocked(get).mockImplementation(()=>new Promise(resolve=>{resolveRequest=resolve;}));
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});let tree:ReturnType<typeof create>;
  act(()=>{tree=create(<QueryClientProvider client={client}><UatPage/></QueryClientProvider>);});
  expect(JSON.stringify(tree!.toJSON())).toContain('資料載入中');
  await act(async()=>{resolveRequest({data:[]});await new Promise(resolve=>setTimeout(resolve,20));});expect(JSON.stringify(tree!.toJSON())).toContain('目前沒有符合條件的資料');act(()=>tree!.unmount());

  vi.mocked(get).mockRejectedValue(new Error('evidence service unavailable'));tree=await render();expect(JSON.stringify(tree.toJSON())).toContain('evidence service unavailable');act(()=>tree.unmount());
});

it('filters API evidence independently from browser-local scenario status',async()=>{
  vi.stubGlobal('localStorage',{getItem:vi.fn(()=>JSON.stringify({'UAT-R6-001':{status:'PASS',evidence:'local-only',tester:'tester',executedAt:'2026-09-18T00:00:00.000Z'}})),setItem:vi.fn()});
  const tree=await render();const labels=tree.root.findAllByType('label');
  const environment=labels.find(label=>label.findAllByType('span')[0]?.children.join('')==='Evidence Environment')!.findByType('input');
  const scenario=labels.find(label=>label.findAllByType('span')[0]?.children.join('')==='Evidence Scenario')!.findByType('select');
  await act(async()=>{environment.props.onChange({target:{value:'uat'}});scenario.props.onChange({target:{value:'UAT-R6-013'}});await new Promise(resolve=>setTimeout(resolve,0));});
  expect(get).toHaveBeenLastCalledWith('/admin/uat-evidence?environment=uat&scenarioCode=UAT-R6-013');
  const output=JSON.stringify(tree.toJSON());expect(output).toContain('local-only');expect(output).toContain('"children":["1"]');
  act(()=>tree.unmount());
});
