import {AdminFaqController,PublicFaqController} from './faq.controller';
import {Module} from '@nestjs/common';
import {DatabaseModule} from '@ucell/database';
import {PublicWebsiteController} from './public-website.controller';
import {PublicWebsiteService} from './public-website.service';
export {PublicWebsiteService} from './public-website.service';
@Module({imports:[DatabaseModule],controllers:[PublicWebsiteController,AdminFaqController,PublicFaqController],providers:[PublicWebsiteService]})
export class PublicWebsiteModule{}
