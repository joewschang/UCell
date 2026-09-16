import {Module}from'@nestjs/common';import{ContentService}from'./content.service';import{AuthModule}from'../auth/auth.module';import{AdminContentController,MemberContentController}from'./content.controller';@Module({imports:[AuthModule],controllers:[AdminContentController,MemberContentController],providers:[ContentService]})export class ContentModule{}

