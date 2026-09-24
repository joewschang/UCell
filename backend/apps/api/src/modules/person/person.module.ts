import { Module } from '@nestjs/common';
import { PersonController } from './person.controller';
import { PersonService } from './person.service';
import { AuthModule } from '../auth/auth.module';

@Module({ imports:[AuthModule],controllers:[PersonController], providers:[PersonService] })
export class PersonModule {}
