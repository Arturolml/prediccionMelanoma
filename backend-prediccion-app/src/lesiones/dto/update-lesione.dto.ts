import { PartialType } from '@nestjs/swagger';
import { CreateLesioneDto } from './create-lesione.dto';

export class UpdateLesioneDto extends PartialType(CreateLesioneDto) {}
