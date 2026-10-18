import assert from 'node:assert/strict';
import {fourMenu} from './four-menu.mjs';
const menu=fourMenu('2011813061-Qt3d2jmo','STAGE');
assert.equal(menu.areas.length,4);
assert.equal(menu.areas.reduce((a,v)=>a+v.bounds.width*v.bounds.height,0),2500*1686);
assert.deepEqual(menu.areas.map(a=>new URL(a.action.uri).pathname),['/2011813061-Qt3d2jmo/','/2011813061-Qt3d2jmo/events','/2011813061-Qt3d2jmo/shop','/2011813061-Qt3d2jmo/faq']);
assert.throws(()=>fourMenu('https://evil.test','STAGE'));
assert.throws(()=>fourMenu('2011813061-Qt3d2jmo','UNKNOWN'));
console.log('PASS: geometry, LIFF routes, explicit environment validation');
