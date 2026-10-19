import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,it,expect,vi} from 'vitest';
import Mall from '../src/Mall';
const state=vi.hoisted(()=>({available:true,offers:[{offeringCode:'TIP636',offeringType:'CORE_PRODUCT',displayName:'測試商品636',composition:[{sku:'TIP-636',quantity:1}],selectionRule:null}],createOrder:vi.fn()}));
vi.mock('../src/memberData',()=>({getFormalEnrollment:vi.fn(),getCommercialOffers:vi.fn(),getProducts:vi.fn(),getDeliveryProfile:vi.fn(),createWebRetailOrder:state.createOrder,createConnectedOrder:state.createOrder,payStageCommerceOrder:vi.fn()}));
vi.mock('../src/useResource',()=>({useResource:(key:string)=>({data:key==='mall-offers'?state.offers:key==='mall-products'?[{id:'p1',sku:'TIP-636',name:'測試商品636',price:'4800',available:state.available}]:{complete:true},retry:vi.fn()})}));
vi.mock('../src/DeliveryProfileEditor',()=>({default:()=> <p>配送資料</p>}));
vi.mock('../src/QualificationPackageShop',()=>({default:()=> <p>資格套組</p>}));
vi.mock('../src/ActiveDurationPackages',()=>({default:()=>null}));
let tree:ReactTestRenderer;
afterEach(()=>{act(()=>tree?.unmount());state.available=true;vi.clearAllMocks()});
it('opens the requested product detail without creating an order',async()=>{
 await act(async()=>{tree=create(<MemoryRouter initialEntries={['/shop?sku=TIP-636']}><Mall onCreated={vi.fn()}/></MemoryRouter>)});
 expect(tree.root.findAllByProps({'aria-label':'已選商品細節'})).toHaveLength(1);
 expect(JSON.stringify(tree.toJSON())).toContain('測試商品636');expect(state.createOrder).not.toHaveBeenCalled();
});
it('does not select an unavailable requested product',async()=>{
 state.available=false;
 await act(async()=>{tree=create(<MemoryRouter initialEntries={['/shop?sku=TIP-636']}><Mall onCreated={vi.fn()}/></MemoryRouter>)});
 expect(tree.root.findAllByProps({'aria-label':'已選商品細節'})).toHaveLength(0);
 expect(JSON.stringify(tree.toJSON())).toContain('目前無法直接訂購');expect(state.createOrder).not.toHaveBeenCalled();
});
