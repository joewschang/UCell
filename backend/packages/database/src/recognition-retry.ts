/** Retry only database-confirmed transaction aborts. Never retry a network error
 * with an unknown commit outcome, a uniqueness violation, or a business error. */
export function isRecognitionTransactionConflict(error: unknown): boolean {
  const e = error as { code?: string; meta?: { code?: string } } | null;
  return e?.code === 'P2034' || (e?.code === 'P2010' && ['40001', '40P01'].includes(e.meta?.code ?? ''));
}

/** The callback must create a NEW transaction on every attempt and contain no
 * external side effects. Four attempts total; release DB locks before backoff. */
export async function withRecognitionRetry<T>(transaction: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await transaction(); }
    catch (error) {
      if (attempt >= 3 || !isRecognitionTransactionConflict(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, 50 * 2 ** attempt + Math.floor(Math.random() * 50)));
    }
  }
}
