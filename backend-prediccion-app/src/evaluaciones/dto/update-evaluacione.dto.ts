import { PartialType } from '@nestjs/swagger';
import { CreateEvaluacioneDto } from './create-evaluacione.dto';

export class UpdateEvaluacioneDto extends PartialType(CreateEvaluacioneDto) {}
