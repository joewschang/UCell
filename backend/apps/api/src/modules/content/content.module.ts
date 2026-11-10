import { PublicHealthGame,MemberHealthGame,AdminHealthGame,HealthGameService } from './health-game.controller';
import {MemberShareLinkService} from '../member/member-share-link.service';
import {ContentInsightsService} from './content-insights.service';
import {MemberContentInsightsController,AdminContentInsightsController,MemberContentShareController} from './content-insights.controller';
import {Module}from'@nestjs/common';import{ContentService}from'./content.service';import{AuthModule}from'../auth/auth.module';import{AdminContentController,MemberContentController,PublicContentController}from'./content.controller';@Module({imports:[AuthModule],controllers:[PublicHealthGame,MemberHealthGame,AdminHealthGame,MemberContentInsightsController,AdminContentInsightsController,MemberContentShareController,AdminContentController,MemberContentController,PublicContentController],providers:[HealthGameService,ContentService,ContentInsightsService,MemberShareLinkService]})export class ContentModule{}

