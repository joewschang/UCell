import { UnprocessableEntityException } from '@nestjs/common';
import type { PaymentConfirmationDto } from './dto/payment-confirmation.dto';

/** Applied to bank/cash reconciliation in the admin portal, after idempotent replay and order locking. */
export function validateManualPaymentReview(
  input: PaymentConfirmationDto,
  zeroBalance: boolean,
  createdAt: Date,
  occurredAt: Date,
) {
  const method = typeof input.paymentMethod === 'string' ? input.paymentMethod.trim() : '';
  if (!method || (zeroBalance ? input.paymentMethod !== 'COUPON_WAIVER' : method.toUpperCase() === 'COUPON_WAIVER')) {
    throw new UnprocessableEntityException({
      code: 'MANUAL_PAYMENT_METHOD_INVALID',
      message: zeroBalance ? '應付零元的訂單請核對優惠全額減免。' : '請填寫公司的實際收款方式。',
    });
  }
  if (typeof input.referenceNo !== 'string' || !input.referenceNo.trim()) {
    throw new UnprocessableEntityException({
      code: 'MANUAL_PAYMENT_REFERENCE_REQUIRED',
      message: '請填寫可追溯的收款憑證或減免核對紀錄。',
    });
  }
  const time = occurredAt.getTime();
  if (!Number.isFinite(time) || time < createdAt.getTime() || time > Date.now() + 60_000) {
    throw new UnprocessableEntityException({
      code: 'MANUAL_PAYMENT_TIME_INVALID',
      message: '請依實際憑證核對時間，收款時間必須介於訂單成立與現在之間。',
    });
  }
}
