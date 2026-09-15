import { Module } from '@nestjs/common';
import { BonusQueryService } from './bonus-query.service';

@Module({providers:[BonusQueryService],exports:[BonusQueryService]})
export class BonusQueryModule {}
