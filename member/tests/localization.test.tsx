import React from 'react';
import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {StatusBadge,QualificationBadge} from '@ucell/design-system';
import {domainLabel,uiText,uiTemplate,languageParameters} from '../../shared/design-system/i18n';

describe('繁體中文顯示與原始業務代碼分離',()=>{
 it('顯示中文狀態，但保留狀態色彩及原始資料',()=>{
  const record={status:'EFFECTIVE',ballNo:'UCELL001X000001'};
  const html=renderToStaticMarkup(<StatusBadge status={record.status}/>);
  expect(html).toContain('已生效');expect(html).toContain('data-tone="success"');
  expect(html).not.toContain('EFFECTIVE');
  expect(record).toEqual({status:'EFFECTIVE',ballNo:'UCELL001X000001'});
 });
 it('保留球號、產品型號與登入服務名稱',()=>{
  expect(uiText('UCELL001X000001')).toBe('UCELL001X000001');
  expect(uiText('TIP-363')).toBe('TIP-363');
  expect(uiText('service@ucell.life')).toBe('service@ucell.life');
  expect(uiText('Google／LINE')).toBe('Google／LINE');
  expect(uiTemplate`Ball Number ${'TREE-A-CURRENT'} · ${'https://ucell.life/path/ACTIVE'}`).toBe('球號 TREE-A-CURRENT · https://ucell.life/path/ACTIVE');
  const html=renderToStaticMarkup(<QualificationBadge code="UCELL001X000001" rank="LEADER"/>);
  expect(html).toContain('UCELL001X000001｜領袖');
 });
 it('區分待處理、等待期與未知狀態',()=>{
  expect(domainLabel('PENDING')).toBe('待處理');
  expect(domainLabel('PENDING_45D')).toBe('45日等待期');
  expect(domainLabel('FUTURE_UNREVIEWED_STATE')).toBe('尚未提供中文名稱');
  expect(domainLabel(null)).toBe('—');
 });
 it('巢狀顯示元件不會重複翻譯，必要英數內容仍保留',()=>{
  for(const text of ['Qualification lifecycle','方案 LEADER','GPV 與 Carry','會員生命週期 · Current Records','Always Active (Company Rule)']){
   expect(uiText(uiText(text))).toBe(uiText(text));
  }
  expect(languageParameters).toEqual({locale:'zh-TW',currency:'TWD',timeZone:'Asia/Taipei'});
 });
});
