import {afterEach,beforeEach,expect,it,vi,type Mock} from 'vitest';
import {openPrivateDocument} from './privateDocument';

let popup:{opener:unknown;closed:boolean;location:{replace:ReturnType<typeof vi.fn>};close:ReturnType<typeof vi.fn>};
let open:ReturnType<typeof vi.fn>,createUrl:Mock<(blob:Blob|MediaSource)=>string>,revokeUrl:Mock<(url:string)=>void>;
beforeEach(()=>{
 vi.useFakeTimers();
 popup={opener:{},closed:false,location:{replace:vi.fn()},close:vi.fn()};
 open=vi.fn(()=>popup);createUrl=vi.fn(()=> 'blob:private-test');revokeUrl=vi.fn();
 vi.stubGlobal('window',{open});
 vi.spyOn(URL,'createObjectURL').mockImplementation(blob=>createUrl(blob) as string);
 vi.spyOn(URL,'revokeObjectURL').mockImplementation(url=>{revokeUrl(url)});
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks()});

it('reserves a detached popup before a delayed authorized download and revokes the private URL',async()=>{
 let resolve!:(blob:Blob)=>void;
 const download=vi.fn(()=>new Promise<Blob>(done=>{resolve=done}));
 const pending=openPrivateDocument(download);
 expect(open).toHaveBeenCalledWith('about:blank','_blank');
 expect(popup.opener).toBeNull();
 expect(open.mock.invocationCallOrder[0]).toBeLessThan(download.mock.invocationCallOrder[0]);
 expect(popup.location.replace).not.toHaveBeenCalled();
 resolve(new Blob(['synthetic'],{type:'image/png'}));await pending;
 expect(popup.location.replace).toHaveBeenCalledWith('blob:private-test');
 expect(popup.close).not.toHaveBeenCalled();
 vi.advanceTimersByTime(60_000);expect(revokeUrl).toHaveBeenCalledWith('blob:private-test');
});
it('does not fetch private content when the browser blocks the popup',async()=>{
 open.mockReturnValueOnce(null);const download=vi.fn();
 await expect(openPrivateDocument(download)).rejects.toThrow('瀏覽器阻擋');
 expect(download).not.toHaveBeenCalled();expect(createUrl).not.toHaveBeenCalled();
});
it('closes the reserved popup after a rejected authorization or scan gate',async()=>{
 await expect(openPrivateDocument(()=>Promise.reject(Error('scan gate blocked')))).rejects.toThrow('scan gate blocked');
 expect(popup.close).toHaveBeenCalledOnce();expect(createUrl).not.toHaveBeenCalled();
});
it('refuses unexpected content types instead of opening active HTML',async()=>{
 await expect(openPrivateDocument(async()=>new Blob(['<script>'],{type:'text/html'}))).rejects.toThrow('文件格式');
 expect(popup.close).toHaveBeenCalledOnce();expect(createUrl).not.toHaveBeenCalled();
});
it('does not create a private URL if the operator closed the popup during download',async()=>{
 popup.closed=true;
 await expect(openPrivateDocument(async()=>new Blob(['synthetic'],{type:'image/jpeg'}))).rejects.toThrow('視窗已關閉');
 expect(createUrl).not.toHaveBeenCalled();
});
it('revokes created bytes immediately if navigation fails',async()=>{
 popup.location.replace.mockImplementationOnce(()=>{throw Error('navigation failed')});
 await expect(openPrivateDocument(async()=>new Blob(['synthetic'],{type:'image/jpeg'}))).rejects.toThrow('navigation failed');
 expect(revokeUrl).toHaveBeenCalledWith('blob:private-test');expect(popup.close).toHaveBeenCalledOnce();
});
