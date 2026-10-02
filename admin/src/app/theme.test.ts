import {describe,expect,it} from 'vitest';
import {resolveUiTheme} from '@ucell/design-system';

describe('shared UI theme resolver',()=>{
  it.each([
    ['SYSTEM',false,'light'],
    ['SYSTEM',true,'dark'],
    ['LIGHT',true,'light'],
    ['DARK',false,'dark'],
  ] as const)('resolves %s safely',(preference,systemDark,expected)=>{
    expect(resolveUiTheme(preference,systemDark)).toBe(expected);
  });
});
