import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateLesioneDto } from './create-lesione.dto';

// La lesión no cambia de paciente.
export class UpdateLesioneDto extends PartialType(OmitType(CreateLesioneDto, ['id_paciente'] as const)) {}
