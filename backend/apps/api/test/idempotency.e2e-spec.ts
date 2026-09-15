describe('Idempotency (P0)', () => {
  it.todo('same key + same payload returns original result');
  it.todo('same key + different payload returns IDEMPOTENCY_CONFLICT');
  it.todo('monthly recognition cannot create RPV twice');
  it.todo('same external event cannot be processed twice');
});
