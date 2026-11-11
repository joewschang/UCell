import {Global,Module} from '@nestjs/common';
import {GreetingPublicationService} from './greeting-publication.service';
import {GreetingPublicationController,DotGreetingController} from './greeting-publication.controller';
@Global() @Module({controllers:[GreetingPublicationController,DotGreetingController],providers:[GreetingPublicationService],exports:[GreetingPublicationService]})
export class GreetingPublicationModule {}
