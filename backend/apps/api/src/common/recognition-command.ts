import { ConflictException } from '@nestjs/common';
import { isRecognitionTransactionConflict, withRecognitionRetry } from '@ucell/database';

export async function runRecognitionCommand<T>(transaction: () => Promise<T>): Promise<T> {
  try { return await withRecognitionRetry(transaction); }
  catch (error) {
    if (isRecognitionTransactionConflict(error)) throw new ConflictException({
      code: 'RECOGNITION_RETRY_EXHAUSTED', details: { retryable: true, attempts: 4 },
      message: 'Recognition transaction conflicted. Retry the same order or recognition ID.',
    });
    throw error;
  }
}
