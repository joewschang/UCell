import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {enrollmentBundlePayment, requirePaidBundleRoot} from '../src/modules/member/enrollment-bundle-payment';
import {readBundleTransfer, reportBundleTransfer} from '../src/modules/member/enrollment-bundle-report';
import {adminBundlePayment, confirmBundlePayment} from '../src/modules/order/enrollment-bundle-receipt';
import {createEnrollmentBundleFixture,markPreexistingCheckout} from './helpers/enrollment-bundle.fixture';
import {createEffectiveMemberSponsorFixture} from './helpers/member-sponsor.fixture';

const url = process.env.PHASE2_TEST_DATABASE_URL;
(url ? describe : describe.skip)('Combined enrollment transfer and per-position allocation', () => {
  const db = new PrismaClient({datasources:{db:{url}}});
  afterAll(() => db.$disconnect());

  it('reports once, reconciles the entry total atomically and defers the selected repurchase', async () => {
    const sponsor = await createEffectiveMemberSponsorFixture(db);
    const f = await createEnrollmentBundleFixture(db, sponsor.qualification.ballNo!);
    await markPreexistingCheckout(db,f.applicationId);
    const group = (await f.service.create(f.personId, f.applicationId, f.input, randomUUID(), randomUUID())).value;
    const entryIds = group.balls.map(b => b.qualification.orderId);
    const repurchase = group.balls[1].repurchase!;
    const actor = sponsor.actor.personId!;
    const at = new Date();
    const reported = {amount:group.qualificationTotal, paidAt:new Date(Math.floor(at.getTime()/60000)*60000).toISOString(), accountLastFive:'00123'};
    const report = (personId:string, body = reported) => db.$transaction(tx => reportBundleTransfer(tx, f.applicationId, personId, body));
    const state = () => enrollmentBundlePayment(db as any, f.applicationId, f.personId);
    await expect(report(actor)).rejects.toMatchObject({response:{code:'ENROLLMENT_BUNDLE_NOT_FOUND'}});
    await expect(report(f.personId, {...reported, amount:group.total})).rejects.toMatchObject({response:{code:'BUNDLE_TRANSFER_INVALID'}});
    const first = await report(f.personId);
    expect(first).toMatchObject({bundleId:group.bundleId, amount:'45000.00', accountLastFive:'00123'});
    expect(await report(f.personId)).toEqual(first);
    expect(await readBundleTransfer(db as any, f.applicationId, actor)).toBeNull();
    await expect(report(f.personId, {...reported, accountLastFive:'00456'})).rejects.toMatchObject({response:{code:'BUNDLE_TRANSFER_ALREADY_REPORTED'}});
    const reportedState = await state();
    expect(reportedState).toMatchObject({rootPaid:false, paymentReported:true, paidQualifications:0, qualificationCount:3});
    expect(() => requirePaidBundleRoot(reportedState)).toThrow();
    const bank = {amount:group.qualificationTotal, paymentMethod:'BANK_TRANSFER', referenceNo:randomUUID(), occurredAt:at.toISOString()};
    const pay = (orderId:string, dto = bank, key = randomUUID()) => f.orders.confirmEnrollmentPayment(orderId, dto, key, randomUUID(), actor);
    await expect(f.orders.confirmPayment(entryIds[1], {...bank, amount:group.balls[1].qualification.total}, randomUUID(), randomUUID(), actor, 'MANUAL_ADMIN'))
      .rejects.toMatchObject({response:{code:'BUNDLE_SINGLE_PAYMENT_NOT_ALLOWED'}});
    await expect(f.orders.confirmPayment(repurchase.orderId, {...bank, amount:repurchase.total}, randomUUID(), randomUUID(), actor, 'MANUAL_ADMIN'))
      .rejects.toMatchObject({response:{code:'BUNDLE_REPURCHASE_AWAITS_PLACEMENT'}});
    await expect(pay(entryIds[1], {...bank, amount:group.total})).rejects.toMatchObject({response:{code:'BUNDLE_RECEIPT_AMOUNT_MISMATCH'}});
    await expect(db.order.update({where:{orderId:entryIds[1]},data:{status:'PAID',paidAt:at}})).rejects.toThrow(/BUNDLE_SINGLE_PAYMENT_NOT_ALLOWED/);
    await expect(db.order.update({where:{orderId:repurchase.orderId},data:{status:'PAID',paidAt:at}})).rejects.toThrow(/BUNDLE_REPURCHASE_AWAITS_PLACEMENT/);
    // Interrupt after two real allocation writes. The receipt, order states, postings and events must roll back together.
    const write = (f.orders as any).confirmPaymentInTransaction.bind(f.orders);
    await expect(db.$transaction(tx => confirmBundlePayment(tx, group.bundleId, bank, actor, randomUUID(), (...args) => {
      if (args[1] === entryIds[2]) throw new Error('interrupted allocation');
      return write(...args);
    }))).rejects.toThrow('interrupted allocation');
    expect(await db.order.count({where:{orderId:{in:entryIds}, status:'CONFIRMED'}})).toBe(3);
    expect(await db.paymentEvent.count({where:{orderId:{in:entryIds}}})).toBe(0);
    expect((await adminBundlePayment(db as any, entryIds[1]))?.receipt).toBeNull();
    const key = randomUUID();
    const [one,two] = await Promise.all([pay(entryIds[1], bank, key),pay(entryIds[0], bank, key)]);
    const settled = one.value;
    expect(two.value.receiptId).toBe(settled.receiptId);
    expect(settled.amount).toBe('45000.00');
    expect((await pay(entryIds[0], bank, key)).replayed).toBe(true);
    expect((await pay(entryIds[2])).value.receiptId).toBe(settled.receiptId);
    const statement = await adminBundlePayment(db as any, entryIds[0]);
    expect(statement?.lines.map(l => [l.position, l.amount, l.status])).toEqual([[1,'15000.00','PAID'],[2,'15000.00','PAID'],[3,'15000.00','PAID']]);
    expect(statement?.receipt?.receiptId).toBe(settled.receiptId);
    const events = await db.paymentEvent.findMany({where:{orderId:{in:entryIds}, referenceNo:bank.referenceNo}});
    expect(events).toHaveLength(3);
    expect(events.reduce((sum,e) => sum + Number(e.amount), 0)).toBe(Number(settled.amount));
    expect(await state()).toMatchObject({rootPaid:true, paidQualifications:3, outstandingQualificationTotal:expect.stringMatching(/^0(\.0+)?$/)});
    expect((await db.order.findUniqueOrThrow({where:{orderId:repurchase.orderId}})).status).toBe('CONFIRMED');
    expect(await db.paymentEvent.count({where:{orderId:repurchase.orderId}})).toBe(0);
    await expect(f.orders.confirmPayment(repurchase.orderId, {...bank, amount:repurchase.total}, randomUUID(), randomUUID(), actor))
      .rejects.toMatchObject({response:{code:'BUNDLE_RECEIPT_ALREADY_USED'}});
  }, 120000);

  it('reconciles every entry at the 63-ball checkout limit and leaves every repurchase open', async () => {
    const sponsor = await createEffectiveMemberSponsorFixture(db);
    const f = await createEnrollmentBundleFixture(db, sponsor.qualification.ballNo!);
    const balls = Array.from({length:63}, () => ({qualification:f.qualification, repurchase:f.repurchase}));
    await markPreexistingCheckout(db,f.applicationId);
    const group = (await f.service.create(f.personId, f.applicationId, {...f.input,balls}, randomUUID(), randomUUID())).value;
    expect(group.balls).toHaveLength(63);
    expect(group.balls[62]).toMatchObject({position:63,parentPosition:31,side:'RIGHT'});
    const payment = {amount:group.qualificationTotal, paymentMethod:'BANK_TRANSFER', referenceNo:randomUUID(), occurredAt:new Date().toISOString()};
    await f.orders.confirmEnrollmentPayment(group.balls[62].qualification.orderId, payment, randomUUID(), randomUUID(), sponsor.actor.personId!);
    expect(await enrollmentBundlePayment(db as any, f.applicationId, f.personId)).toMatchObject({qualificationCount:63, paidQualifications:63});
    expect(await db.order.count({where:{orderId:{in:group.balls.map(b=>b.repurchase!.orderId)},status:'CONFIRMED'}})).toBe(63);
  }, 180000);
});
