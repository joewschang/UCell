import React from 'react';
import {act,create} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {expect,it,vi} from 'vitest';
import SharingProgress from '../src/SharingProgress';
const state=vi.hoisted(()=>({data:null as any,error:null as any,retry:vi.fn()}));
vi.mock('../src/useResource',()=>({useResource:()=>state}));
it('shows achieved stages and encouragement without claiming orders or rewards',()=>{state.data={rows:[{links:2,visitors:4,registrations:0,lastMessage:'謝謝您的分享',lastEncouragedAt:'2026-10-23T00:00:00Z'}]};state.error=null;let tree:any;act(()=>{tree=create(<MemoryRouter><SharingProgress qualificationId="ball"/></MemoryRouter>)});expect(tree.root.findAllByProps({className:'achieved'})).toHaveLength(2);expect(JSON.stringify(tree.toJSON())).toContain('謝謝您的分享');expect(JSON.stringify(tree.toJSON())).toContain('里程碑不影響資格與獎金');expect(tree.root.findAllByType('a').map((n:any)=>n.props.href)).toContain('/notifications');act(()=>tree.unmount());});
it('explains progress failures and provides a retry',()=>{state.data=null;state.error='network';let tree:any;act(()=>{tree=create(<MemoryRouter><SharingProgress qualificationId="ball"/></MemoryRouter>)});expect(tree.root.findAllByProps({role:'alert'})).toHaveLength(1);act(()=>tree.root.findByType('button').props.onClick());expect(state.retry).toHaveBeenCalled();act(()=>tree.unmount());});
