import {Module} from '@nestjs/common';
import {PiiCryptoService} from '@ucell/database';
import {OrganizationGeoController} from './organization-geo.controller';
import {OrganizationGeoService} from './organization-geo.service';
import {GeoProfileService} from './geo-profile.service';
import {GeoProfileRefreshRunner} from './geo-profile-refresh.runner';
@Module({controllers:[OrganizationGeoController],providers:[OrganizationGeoService,GeoProfileService,GeoProfileRefreshRunner,PiiCryptoService]})
export class OrganizationGeoModule {}
