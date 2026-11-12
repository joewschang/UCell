import {expect,it} from 'vitest';
import liff from '@line/liff';
it('loads a LIFF release outside the deprecated 2.20.0-2.31.0 range',()=>{const [major,minor,patch]=liff.getVersion().split('.').map(Number);expect(major>2||(major===2&&(minor>31||(minor===31&&patch>=1)))).toBe(true);});
