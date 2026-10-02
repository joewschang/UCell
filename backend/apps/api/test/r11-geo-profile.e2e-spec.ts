import {GeoProfileService} from '../src/modules/organization-geo/geo-profile.service';
describe('R1.1 historical geo profile privacy',()=>{
  const at=new Date('2026-10-02T00:00:00Z'),known=new Date('2026-10-02T01:00:00Z');
  const service=new GeoProfileService({} as any);
  const row={effectiveAt:at,recordedAt:known,addressHash:'private-hash',hashKeyVersion:'v1',catalogVersion:'c1',cityCode:'city',districtCode:'district',geoStatus:'NORMALIZED',reason:null};
  it('uses historical effective and recorded cutoffs rather than current projection',async()=>{
    const findMany=jest.fn().mockResolvedValue([row]);
    const r=await service.at({memberGeoProfileEvent:{findMany}} as any,'person',at,known);
    expect(findMany.mock.calls[0][0].where).toEqual({personId:'person',effectiveAt:{lte:at},recordedAt:{lte:known}});
    expect(r).toMatchObject({cityCode:'city',districtCode:'district'});
    expect(JSON.stringify(r)).not.toContain('private-hash');
  });
  it('does not silently use current geography for missing historical evidence',async()=>{
    expect(await service.at({memberGeoProfileEvent:{findMany:async()=>[]}} as any,'person',at,known)).toMatchObject({status:'UNAVAILABLE',reason:'GEO_HISTORY_MISSING'});
  });
  it('fails closed on ambiguous same-time geography',async()=>{
    expect(await service.at({memberGeoProfileEvent:{findMany:async()=>[row,{...row,addressHash:'other'}]}} as any,'person',at,known)).toMatchObject({status:'UNAVAILABLE',reason:'AMBIGUOUS_GEO_HISTORY'});
  });
  it('partial address preserves known city and unlocated district',async()=>{
    expect(await service.at({memberGeoProfileEvent:{findMany:async()=>[{...row,geoStatus:'PARTIAL',districtCode:null,reason:'DISTRICT_NOT_FOUND'}]}} as any,'person',at,known)).toMatchObject({status:'PARTIAL',cityCode:'city',districtCode:null});
  });
  const input={personId:'p',sourceEventId:'source',address:'台北市中正區測試路一號',countryCode:'TW',effectiveAt:'2026-10-01T00:00:00Z',catalogVersion:'catalog',hashKeyVersion:'key-v1'};
  const areas=[{countryCode:'TW',level:'CITY',areaCode:'c',parentAreaCode:null,areaNameZh:'臺北市',aliases:[]},{countryCode:'TW',level:'DISTRICT',areaCode:'d',parentAreaCode:'c',areaNameZh:'中正區',aliases:[]}];
  function consumer(existing:any=null, newer=false){
    const create=jest.fn().mockImplementation(async({data})=>({...data,eventId:'new-event'}));
    const upsert=jest.fn();
    const tx={
      $executeRaw:jest.fn(),geoAdminArea:{findMany:async()=>areas},
      memberGeoProfileEvent:{findUnique:async()=>existing,findFirst:jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({eventId:newer?'newer-event':'new-event'}),create},
      memberGeoProfile:{upsert},
    };
    const service=new GeoProfileService({$transaction:async(work:any)=>work(tx)} as any);
    return {service,tx,create,upsert};
  }
  it('persists aggregate geography and history without residential address bytes',async()=>{
    const c=consumer();await c.service.recognize(input,'12345678901234567890123456789012');
    expect(c.create.mock.calls[0][0].data).toMatchObject({cityCode:'c',districtCode:'d',geoStatus:'NORMALIZED'});
    expect(JSON.stringify(c.create.mock.calls)).not.toContain('測試路');
    expect(c.upsert).toHaveBeenCalledTimes(1);
  });
  it('late historical event does not regress current geography',async()=>{
    const c=consumer(null,true);await c.service.recognize(input,'12345678901234567890123456789012');
    expect(c.create).toHaveBeenCalledTimes(1);expect(c.upsert).not.toHaveBeenCalled();
  });
  it('matching source retry appends no duplicate history',async()=>{
    const first=consumer();await first.service.recognize(input,'12345678901234567890123456789012');
    const row={...first.create.mock.calls[0][0].data,eventId:'old-event'};
    const c=consumer(row);expect(await c.service.recognize(input,'12345678901234567890123456789012')).toEqual({eventId:'old-event',replayed:true});
    expect(c.create).not.toHaveBeenCalled();expect(c.upsert).not.toHaveBeenCalled();
  });
  it('source retry with changed address is rejected atomically',async()=>{
    const first=consumer();await first.service.recognize(input,'12345678901234567890123456789012');
    const c=consumer({...first.create.mock.calls[0][0].data,eventId:'old-event'});
    await expect(c.service.recognize({...input,address:'台北市中正區其他路一號'},'12345678901234567890123456789012')).rejects.toMatchObject({response:{code:'GEO_SOURCE_IDEMPOTENCY_CONFLICT'}});
    expect(c.create).not.toHaveBeenCalled();
  });
});
