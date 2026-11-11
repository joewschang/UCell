const assert = require('node:assert/strict');
const {formatRepurchaseNames} = require('./repurchase-display');
const fixtures = [
 ['ACTIVE_QUARTER','季活躍','重銷（三個月）',3],
 ['ACTIVE_HALF_YEAR','半年活躍','重銷（六個月）',6],
 ['ACTIVE_YEAR','年活躍','重銷（十二個月）',12]
];
for (const [code,legacy,label,months] of fixtures) {
  const response = {catalog:{packageCode:code,displayName:legacy},admin:{stableCode:code,versions:[{packageProfileVersionId:'id',displayName:legacy}]},
                    orders:[{packageName:legacy}],plan:{planCode:code,displayName:legacy,durationMonths:months},member:{displayName:legacy}};
  formatRepurchaseNames(response);
  assert.equal(response.catalog.displayName,label);
  assert.equal(response.admin.versions[0].displayName,label);
  assert.equal(response.orders[0].packageName,label);
  assert.deepEqual(response.plan,{planCode:code,displayName:label,durationMonths:months});
  assert.equal(response.member.displayName,legacy);
}
console.log('Verified member catalog, admin versions, historical orders and subscription labels for all three durations.');
