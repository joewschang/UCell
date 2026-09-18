import {BinaryTreeReadController} from './binary-tree-read.controller';
import {BinaryTreeReadService} from './binary-tree-read.service';
import {Module} from '@nestjs/common';
import {OrganizationModule} from '../organization/organization.module';
import {BinaryTreeService} from './binary-tree.service';
import {BinaryTreeController} from './binary-tree.controller';
@Module({imports:[OrganizationModule],providers:[BinaryTreeService,BinaryTreeReadService],controllers:[BinaryTreeController,BinaryTreeReadController],exports:[BinaryTreeService]})
export class BinaryTreeModule {}
