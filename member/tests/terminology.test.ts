import {describe,expect,it} from 'vitest';
import {availabilityText,awardStatusLabels,formatNullableMoney,formatNullableNumber,qualificationActiveLabel,qualificationRankLabel} from '../src/terminology';

describe('member terminology',()=>{
  it('distinguishes missing fields and unavailable read models',()=>{
    expect(formatNullableNumber(null)).toBe('尚未提供');
    expect(formatNullableMoney(null)).toBe('尚未提供');
    expect(availabilityText.readModelMissing).toBe('功能資料尚未接入');
  });

  it('uses approved member-facing status labels without changing domain enums',()=>{
    expect(awardStatusLabels.PENDING45D).toBe('45日等待期');
    expect(awardStatusLabels.CLAWBACK).toBe('追扣／抵扣調整');
    expect(qualificationActiveLabel(true)).toBe('資格狀態：有效');
    expect(qualificationActiveLabel(false)).toBe('資格狀態：未有效');
    expect(qualificationRankLabel('ELITE')).toBe('菁英');
    expect(qualificationRankLabel('FUTURE_RANK')).toBe('FUTURE_RANK');
  });

  it('preserves real zero values',()=>{
    expect(formatNullableMoney(0)).toBe('NT$ 0');
    expect(formatNullableNumber(0)).toBe('0');
  });
});
