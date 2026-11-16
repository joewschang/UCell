import {GreetingPushController} from './greeting-push.controller';
import {GreetingPushService} from './greeting-push.service';
import {CloudGreetingController} from './cloud-greeting.controller';
import {CloudGreetingService} from './cloud-greeting.service';
import {CloudGreetingProvider} from './cloud-greeting-provider';
import {GreetingMachineGuard,GreetingPushGuard} from './cloud-greeting-auth';
import {Global,Module} from '@nestjs/common';
import {GreetingPublicationService} from './greeting-publication.service';
import {GreetingPublicationController,DotGreetingController} from './greeting-publication.controller';
@Global() @Module({controllers:[GreetingPushController,GreetingPublicationController,DotGreetingController,CloudGreetingController],providers:[GreetingPushService,GreetingPushGuard,GreetingPublicationService,CloudGreetingService,CloudGreetingProvider,GreetingMachineGuard],exports:[GreetingPublicationService,CloudGreetingService]})
export class GreetingPublicationModule {}
