import { Module } from '@nestjs/common';
import { ActiveController } from './active.controller';
import { ActiveService } from './active.service';

@Module({controllers:[ActiveController],providers:[ActiveService],exports:[ActiveService]})
export class ActiveModule {}
