import {expect,it} from 'vitest';
import {formatStoredDecimal} from './stored-decimal';
it.each([['10000000000000.0001','10,000,000,000,000.0001'],['9007199254740993.1234','9,007,199,254,740,993.1234'],['-1234567.0001','-1,234,567.0001'],['0.0000','0.0000'],['1234','1,234.00'],['1.1','1.10'],['1.123456','1.123456']])('displays saved %s exactly', (value,expected)=>expect(formatStoredDecimal(value)).toBe(expected));
it.each([10000000000000.0001,null,undefined,'NaN','1e9','Infinity',''])('does not turn invalid %j into zero or rounded success',value=>expect(formatStoredDecimal(value)).toBe('金額格式異常'));
