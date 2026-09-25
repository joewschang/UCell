import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { OrderService } from './order.service';
@Injectable()
export class PaperReceiptService {
 constructor(private readonly db:PrismaService,private readonly orders:OrderService) {}
 async enter(input:any):Promise<any> {
  const receiptReference=input.receiptReference.trim();
  const where={receiptReference_paymentChannel_paymentNamespace:{receiptReference,paymentChannel:input.paymentChannel,paymentNamespace:input.paymentNamespace}};
  const amount=new Prisma.Decimal(input.amount);
  const existing=await this.db.paperReceiptEvidence.findUnique({where});
  if(existing){if(existing.orderId!==input.orderId||!existing.amount.equals(amount)||existing.currency!==input.currency)throw new ConflictException({code:'PAPER_RECEIPT_IDENTITY_CONFLICT'});return existing;}
  return this.db.paperReceiptEvidence.create({data:{orderId:input.orderId,receiptReference,paymentChannel:input.paymentChannel,paymentNamespace:input.paymentNamespace,amount,currency:input.currency,receivedAt:new Date(input.receivedAt),evidenceDocumentRef:input.evidenceDocumentRef,note:input.note,enteredBy:input.actorId}});
 }
 async approve(input:any):Promise<any> {
  const receipt=await this.db.paperReceiptEvidence.findUnique({where:{receiptReference_paymentChannel_paymentNamespace:{receiptReference:input.receiptReference,paymentChannel:input.paymentChannel,paymentNamespace:input.paymentNamespace}}});
  if(!receipt)throw new ConflictException({code:'PAPER_RECEIPT_NOT_FOUND'});
  const order=await this.db.order.findUnique({where:{orderId:receipt.orderId}});
  if(!order)throw new ConflictException({code:'RESOURCE_NOT_FOUND'});
  if(order.purpose==='ENTRY'&&receipt.enteredBy===input.actorId)throw new UnprocessableEntityException({code:'PAPER_PAYMENT_DUAL_CONTROL_REQUIRED'});
  if(receipt.confirmedBy)throw new ConflictException({code:'PAPER_RECEIPT_ALREADY_CONFIRMED'});
  const result=await this.orders.confirmPayment(receipt.orderId,{amount:receipt.amount.toString(),paymentMethod:receipt.paymentChannel,referenceNo:receipt.receiptReference,occurredAt:receipt.receivedAt.toISOString(),note:receipt.note??undefined},input.key,input.requestId,input.actorId);
  await this.db.paperReceiptEvidence.update({where:{paperReceiptEvidenceId:receipt.paperReceiptEvidenceId},data:{confirmedBy:input.actorId,confirmationAt:new Date()}});
  return result;
 }
}
