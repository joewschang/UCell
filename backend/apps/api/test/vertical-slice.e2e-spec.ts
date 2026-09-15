/**
 * Vertical Slice acceptance scenarios.
 *
 * These tests become executable once the test database bootstrap is wired.
 */
describe('UCell first vertical slice', () => {
  it.todo('creates Person with idempotent command');
  it.todo('creates Qualification with permanent sponsor sequence');
  it.todo('rejects 1st direct placed on RIGHT');
  it.todo('creates order using server-side Product Rule Profile snapshot');
  it.todo('confirms payment exactly once');
  it.todo('writes SALE_CONFIRMED to transactional outbox');
  it.todo('worker converts SALE_CONFIRMED to GPV_CREATED per order line');
  it.todo('reprocessing same outbox event does not duplicate GPV');
  it.todo('PV ledger cannot be UPDATEd or DELETEd');
});
