const scope=require('../person/member-scope.cjs');
exports.currentMembers={status:{notIn:['VOIDED','CLOSED']},...scope};
// The immutable TW number may already belong to a different record even after its
// phone was removed. Preserve the generated member number for the new identity.
exports.numberReserved=async(tx,mobile,personId)=>{
 const local=require('../../common/utils/taiwan-mobile').mobileSpellings(mobile||'')[0];
 if(!/^09\d{8}$/.test(local))return false;
 const owner=await tx.person.findUnique({where:{memberNo:'TW'+local},select:{personId:true}});
 return !!owner && owner.personId!==personId;
};
