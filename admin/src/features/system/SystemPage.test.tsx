import React from 'react';
import {create} from 'react-test-renderer';
import {expect,it} from 'vitest';
import {SystemPage} from './SystemPage';

it('presents the route inventory as a non-authoritative static snapshot',()=>{
  const output=JSON.stringify(create(<SystemPage/>).toJSON());
  expect(output).toContain('Static snapshot');
  expect(output).toContain('Known drift');
  expect(output).toContain('backend/openapi.generated.json');
  expect(output).toContain('不是即時健康檢查或 Release Gate');
  expect(output).not.toContain('Offline Gate PASS');
});
