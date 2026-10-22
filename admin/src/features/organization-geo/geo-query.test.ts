import {expect,it} from 'vitest';
import {buildGeoQuery,geoReason,trendInterval} from './geo-query';
const input={root:'ax000001',side:'ALL',period:'30',customFrom:'',customTo:'',checkpoint:'',knownAt:''},clock=new Date('2026-10-23T04:00:00Z');
it('uses Taipei calendar dates and includes the final selected day',()=>{const q=buildGeoQuery({...input,period:'CUSTOM',customFrom:'2026-10-01',customTo:'2026-10-02'},clock);expect(q.rootBallNo).toBe('AX000001');expect(q.dateFrom).toBe('2026-09-30T16:00:00.000Z');expect(q.dateTo).toBe('2026-10-02T16:00:00.000Z')});
it('reports missing dates and inverted periods before issuing a request',()=>{expect(()=>buildGeoQuery({...input,period:'CUSTOM'},clock)).toThrow('有效期間');expect(()=>buildGeoQuery({...input,period:'CUSTOM',customFrom:'2026-10-05',customTo:'2026-10-02'},clock)).toThrow('有效期間')});
it('rejects future history times and invalid roots with actionable copy',()=>{expect(()=>buildGeoQuery({...input,checkpoint:'2027-01-01T00:00'},clock)).toThrow('不可晚於現在');expect(()=>buildGeoQuery({...input,root:'123'},clock)).toThrow('完整球號')});
it('uses weeks for longer custom periods and Chinese evidence explanations',()=>{expect(trendInterval({dateFrom:'2026-01-01',dateTo:'2026-03-01'})).toBe('WEEK');expect(geoReason('GEO_SCALE_PROJECTION_REQUIRED')).toContain('500');expect(geoReason('UNKNOWN_INTERNAL_CODE')).not.toContain('UNKNOWN_INTERNAL_CODE')});
