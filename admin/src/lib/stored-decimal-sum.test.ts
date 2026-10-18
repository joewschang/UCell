import {expect,it} from 'vitest';
import {formatStoredDecimal,sumStoredDecimals} from './stored-decimal';
it('sums empty, mixed-scale and large decimal values without rounding',()=>{
 expect(formatStoredDecimal(sumStoredDecimals([]))).toBe('0.00');
 expect(sumStoredDecimals(['0.1','0.20'])).toBe('0.30');
 expect(sumStoredDecimals(['9999999999999.1234','0.0001'])).toBe('9999999999999.1235');
 expect(sumStoredDecimals(['-1.2','0.01'])).toBe('-1.19');
});
it('does not turn missing or malformed financial data into zero',()=>{
 for(const invalid of [null,undefined,0,'','1e2','NaN'])expect(formatStoredDecimal(sumStoredDecimals(['1',invalid]))).toBe('金額格式異常');
});
