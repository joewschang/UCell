// An administrative identity can share an email with a separate member identity.
// Keep reserving email for onboarding records, paper members and dual-role people.
module.exports={NOT:{
 membershipState:null,
 adminAccessGrants:{some:{}},
 memberPasswordCredential:{is:null},
 identityLinks:{none:{provider:{in:['LINE','GOOGLE','MEMBER_LOCAL']},status:'ACTIVE'}},
 formalMemberApplications:{none:{}}
}};
