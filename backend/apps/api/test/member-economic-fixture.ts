/** Ordinary-member persistence fixture; economic amounts and original assertions stay unchanged. */
export function memberEconomicMocks(){return {
 qualificationHolderHistory:{findFirst:jest.fn(async()=>({holderPersonId:'historical-member'}))},
 bonusOpportunity:{findUnique:jest.fn(async()=>null),findMany:jest.fn(async()=>[]),create:jest.fn(async({data}:any)=>({...data,bonusOpportunityId:'test-opportunity'}))},
 memberNotification:{upsert:jest.fn(async({create}:any)=>create)},
 notificationDelivery:{create:jest.fn(async({data}:any)=>data)},
 outboxEvent:{create:jest.fn(async({data}:any)=>data)},
 globalPoolSettlement:{findMany:jest.fn(async()=>[])},
 qualificationOwnerInterval:{findMany:jest.fn(async()=>[])},
 awardEconomicDestination:{findFirst:jest.fn(async()=>null)},
 qualification:{findUnique:jest.fn(async()=>({kind:'MEMBER_ORIGIN',currentCompanyPrincipalId:null}))}
};}
