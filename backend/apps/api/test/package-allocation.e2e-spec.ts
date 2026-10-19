import {Prisma,qualificationPackageAllocation,qualificationPackagePolicy} from '@ucell/database';

describe('approved qualification package allocation',()=>{
 it.each([['STARTER','14400',3,'8640'],['ELITE','43200',9,'25920'],['LEADER','72000',15,'43200']] as const)('%s conserves cash and GPV across mixed selections',(packageCode,price,boxes,gpv)=>{
  const purchase={packageCode,packageClass:'QUALIFICATION',recognitionConfigRef:qualificationPackagePolicy,currency:'TWD',priceAmount:new Prisma.Decimal(price),selectableProductQuantity:boxes};
  const lines=[1,boxes-1].map(q=>({quantity:new Prisma.Decimal(q),ruleProfileSnapshot:{packageSelection:true}}));
  const basis=qualificationPackageAllocation(purchase,lines,purchase.priceAmount);
  expect(basis.cashPerBox.toString()).toBe('4800');
  expect(basis.gpvPerBox.mul(boxes).toString()).toBe(gpv);
  expect(()=>qualificationPackageAllocation(purchase,[{...lines[0],quantity:new Prisma.Decimal('0.5')},lines[1]],purchase.priceAmount)).toThrow('PACKAGE_SELECTION_QUANTITY_MISMATCH');
  expect(()=>qualificationPackageAllocation(purchase,lines,purchase.priceAmount.sub(1))).toThrow('PACKAGE_RECOGNITION_POLICY_MISMATCH');
 });
});
