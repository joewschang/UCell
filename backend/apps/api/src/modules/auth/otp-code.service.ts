import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
@Injectable()
export class OtpCodeService { generate(){return String(randomInt(0,1_000_000)).padStart(6,'0');} }
