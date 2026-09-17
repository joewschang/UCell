import React from 'react';
import {create} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {UatPage} from './UatPage';

beforeEach(()=>{
  vi.stubGlobal('localStorage',{
    getItem:vi.fn(()=>null),
    setItem:vi.fn()
  });
});

it('labels every browser-local UAT result and export as non-formal evidence',()=>{
  const output=JSON.stringify(create(<UatPage/>).toJSON());
  expect(output).toContain('LOCAL_ASSISTIVE_ONLY');
  expect(output).toContain('localStorage');
  expect(output).toContain('不得作為 UAT 簽核、Release Gate PASS 或 Production Promotion 依據');
  expect(output).toContain('匯出本機輔助 JSON（非簽核）');
  expect(output).not.toContain('R6正式UAT執行清單');
});
