'use strict';
// The document remains attached to the original application and signing snapshot.
// Changes to the contracting party or the agreement itself need a new signature.
function sameSignerAndContract(before, after) {
 if (!before?.formalContractVersionId || before.formalContractVersionId !== after.formalContractVersionId) return false;
 const fields = ['applicantType','legalName','nationalityCode','identityDocumentType','identityDocumentNumber',
   'legalEntityName','legalEntityRegistrationNo','representativeName','representativeLegalName',
   'representativeNationalityCode','representativeIdentityDocumentType','representativeIdentityDocumentNumber'];
 return fields.every(key => (before[key] ?? null) === (after[key] ?? null));
}
module.exports={sameSignerAndContract};
