import {describe,it,expect} from 'vitest';
import {ballRankPresentation} from '../src/ballRankPresentation';

const snapshot=(achieved:unknown[])=>({asOf:'2026-10-03T00:00:00Z',dimensions:{globalRank:{achieved}}});
const achievement=(qualificationNo:string,rankCode:string,achievedAt='2026-10-01T00:00:00Z')=>({qualificationNo,rankCode,achievedAt});
describe('earned rank presentation per Ball',()=>{
 it('keeps separate Ball histories and takes highest achievement irrespective of order',()=>{
  expect(ballRankPresentation(snapshot([achievement('1','DIAMOND'),achievement('2','NEW_STAR'),achievement('1','EXCELLENCE'),achievement('foreign','CROWN')]),['1','2','3'])).toEqual({'1':'DIAMOND','2':'NEW_STAR'});
 });
 it('does not award a badge from future achievements or package levels',()=>{
  const data={...snapshot([achievement('1','CROWN','2026-10-04T00:00:00Z')]),qualifications:[{qualificationNo:'1',planLevelCode:'LEADER'}]};
  expect(ballRankPresentation(data,['1'])).toEqual({});
 });
 it('distinguishes an empty earned history from unavailable or malformed data',()=>{
  expect(ballRankPresentation(snapshot([]),['1'])).toEqual({});
  for(const data of [null,{},snapshot([achievement('1','HONOR')]),snapshot([achievement('1','NEW_STAR','invalid')])])expect(()=>ballRankPresentation(data,['1'])).toThrow();
 });
});
