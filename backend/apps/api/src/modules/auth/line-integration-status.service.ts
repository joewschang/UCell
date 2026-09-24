import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@ucell/database';

/** Read-only operational status. Deliberately exposes configuration presence, never secret values. */
@Injectable()
export class LineIntegrationStatusService {
  constructor(private readonly db:PrismaService,private readonly config:ConfigService){}
  async read(){
    const deliveryRows=await (this.db.notificationDelivery as any).groupBy({by:['status'],_count:{_all:true}});
    const recentDeliveries=await (this.db.notificationDelivery as any).findMany({orderBy:{createdAt:'desc'},take:20,select:{notificationType:true,status:true,attemptCount:true,lastAttemptAt:true,providerCorrelation:true,failureCode:true,createdAt:true}});
    const lastWebhook=await this.db.providerWebhookInbox.findFirst({where:{domain:'IDENTITY',provider:'LINE_MESSAGING',connectionId:'LINE_MESSAGING_DEFAULT'},orderBy:{receivedAt:'desc'},select:{receivedAt:true,status:true}});
    return {
      messaging:{
        webhookConfigured:!!this.config.get<string>('LINE_MESSAGING_CHANNEL_SECRET')&&!!this.config.get<string>('LINE_MESSAGING_CONFIG_VERSION'),
        senderConfigured:!!this.config.get<string>('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN'),
        workerEnabled:this.config.get<string>('LINE_MESSAGING_WORKER_ENABLED')==='true',
        lastWebhook:lastWebhook?{receivedAt:lastWebhook.receivedAt,status:lastWebhook.status}:null,
      },
      deliveries:deliveryRows.map((row:any)=>({status:row.status,count:row._count._all})),
      recentDeliveries,
    };
  }
}