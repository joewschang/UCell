/** Ordinary-member persistence fixture; economic amounts and original assertions stay unchanged. */
export function memberEconomicMocks(){return {
 globalPoolSettlement:{findMany:jest.fn(async()=>[])},
 qualificationOwnerInterval:{findMany:jest.fn(async()=>[])},
 awardEconomicDestination:{findFirst:jest.fn(async()=>null)},
 qualification:{findUnique:jest.fn(async()=>({kind:'MEMBER_ORIGIN',currentCompanyPrincipalId:null}))}
};}
