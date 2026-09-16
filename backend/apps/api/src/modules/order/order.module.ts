import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { PackageConfigModule } from '../package-config/package-config.module';

@Module({ imports:[PackageConfigModule], controllers: [OrderController], providers: [OrderService], exports:[OrderService] })
export class OrderModule {}
