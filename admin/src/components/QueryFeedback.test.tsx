import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import {QueryFeedback} from './QueryFeedback';
it('distinguishes loading, an empty successful result and a denied request',()=>{
 const refetch=vi.fn();
 const loading=renderToStaticMarkup(<QueryFeedback query={{isPending:true,error:null,refetch}} empty/>);
 expect(loading).toContain('資料載入中');expect(loading).not.toContain('目前沒有');
 const empty=renderToStaticMarkup(<QueryFeedback query={{isPending:false,error:null,refetch}} empty/>);expect(empty).toContain('目前沒有符合條件');
 const denied=renderToStaticMarkup(<QueryFeedback query={{isPending:false,error:Error('403 denied'),refetch}} empty/>);
 expect(denied).toContain('403 denied');expect(denied).toContain('重新載入');expect(denied).not.toContain('目前沒有符合條件');
});
