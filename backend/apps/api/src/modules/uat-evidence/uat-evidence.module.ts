import { Module } from '@nestjs/common';
import { UatEvidenceController } from './uat-evidence.controller';
import { UatEvidenceService } from './uat-evidence.service';

@Module({ controllers: [UatEvidenceController], providers: [UatEvidenceService] })
export class UatEvidenceModule {}
