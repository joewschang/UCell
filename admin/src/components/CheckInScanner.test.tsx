import {expect,it} from 'vitest';
import {parseCheckInQr} from './CheckInScanner';
it('accepts only expected kind and 43-character tokens',()=>{const token='a'.repeat(43);expect(parseCheckInQr('UCELL:EVENT:'+token,'EVENT')).toBe(token);expect(parseCheckInQr(token,'EVENT')).toBe(token);expect(()=>parseCheckInQr('UCELL:LEARNING:'+token,'EVENT')).toThrow();expect(()=>parseCheckInQr('https://example.com','EVENT')).toThrow();});
