import { Module } from '@nestjs/common';
import { ActiveModule } from '../active/active.module';
import { RpvController } from './rpv.controller';
import { RpvService } from './rpv.service';

@Module({
  imports:[ActiveModule],
  controllers:[RpvController],
  providers:[RpvService],
  exports:[RpvService]
})
export class RpvModule {}
