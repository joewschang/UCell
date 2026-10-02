import {GeoProfileRefreshRunner} from '../src/modules/organization-geo/geo-profile-refresh.runner';
import {GeoProfileService} from '../src/modules/organization-geo/geo-profile.service';
describe('Geo projection scheduling',()=>{
 it('starts each new cycle at the beginning so random audit IDs behind the prior cursor are not missed',async()=>{
  const refresh=jest.fn().mockResolvedValueOnce({nextCursor:'cursor-a',created:0}).mockResolvedValueOnce({nextCursor:null,created:0}).mockResolvedValueOnce({nextCursor:null,created:0});
  const runner=new GeoProfileRefreshRunner({refresh} as unknown as GeoProfileService);
  await runner.tick();await runner.tick();await runner.tick();expect(refresh.mock.calls).toEqual([[undefined],['cursor-a'],[undefined]]);
 });
 it('does not overlap batches and retains cursor after a retryable failure',async()=>{
  let release:(value:unknown)=>void=()=>{};
  const refresh=jest.fn().mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;})).mockRejectedValueOnce(new Error('TEST ONLY FAILURE')).mockResolvedValueOnce({nextCursor:null,created:0});
  const runner=new GeoProfileRefreshRunner({refresh} as unknown as GeoProfileService);
  const first=runner.tick();await runner.tick();expect(refresh).toHaveBeenCalledTimes(1);release({nextCursor:'cursor-a',created:0});await first;
  await runner.tick();await runner.tick();expect(refresh.mock.calls).toEqual([[undefined],['cursor-a'],['cursor-a']]);
 });
});
