import {Module} from '@nestjs/common';
import {ReservoirController} from './reservoir.controller';
import {ReservoirService} from './reservoir.service';
@Module({controllers:[ReservoirController],providers:[ReservoirService],exports:[ReservoirService]})
export class ReservoirModule{}
