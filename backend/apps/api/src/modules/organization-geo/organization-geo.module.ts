import {Module} from '@nestjs/common';
import {PiiCryptoService} from '@ucell/database';
import {OrganizationGeoController} from './organization-geo.controller';
import {OrganizationGeoService} from './organization-geo.service';
import {GeoProfileService} from './geo-profile.service';
@Module({controllers:[OrganizationGeoController],providers:[OrganizationGeoService,GeoProfileService,PiiCryptoService]})
export class OrganizationGeoModule {}
