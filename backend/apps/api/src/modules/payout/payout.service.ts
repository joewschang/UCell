import { Injectable } from '@nestjs/common';
import { UnifiedPayableService } from './unified-payable.service';

/**
 * @deprecated Compatibility façade.
 * All new payout logic must use UnifiedPayableService so partial Recovery,
 * PayableEntry allocation and Qualification-first accounting cannot be bypassed.
 */
@Injectable()
export class PayoutService {
  constructor(private readonly unified:UnifiedPayableService){}

  build(periodStart:Date,periodEnd:Date){
    return this.unified.createPayoutBatch(periodStart,periodEnd);
  }
}
