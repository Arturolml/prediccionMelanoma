import { Controller, Get, Post, Body, Param, Query, UseInterceptors, UploadedFile, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { EvaluacionesService } from './evaluaciones.service';
import { PacientesService } from '../pacientes/pacientes.service';
import { CreateEvaluacioneDto } from './dto/create-evaluacione.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('evaluaciones')
export class EvaluacionesController {
  constructor(
    private readonly evaluacionesService: EvaluacionesService,
    private readonly pacientesService: PacientesService
  ) { }

  @Post()
  @Roles('medico', 'enfermero')
  @UseInterceptors(FileInterceptor('imagen', {
    storage: diskStorage({
      destination: async (req, file, cb) => {
        // Mock logic - we need to query DB to get CURP, but multer runs before handler.
        // Strategy: Save to temp, then move? Or just use ID?
        // Better: Use a custom storage engine or just save to 'uploads' globally and simpler logic?
        // Requirement: "carpeta con la curp". 
        // Problem: We don't have the patient CURP easily available in multer config sync.
        // Solution: Save to './uploads/temp', then in the handler move it.
        cb(null, './uploads');
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = extname(file.originalname);
        cb(null, `temp-${uniqueSuffix}${ext}`);
      }
    })
  }))
  async create(
    @Body() createEvaluacioneDto: any, // Use any because multipart/form-data sends strings
    @UploadedFile() file: Express.Multer.File
  ) {
    // 1. Convert DTO types (multipart sends everything as strings)
    const dto: CreateEvaluacioneDto = {
      ...createEvaluacioneDto,
      id_lesion: +createEvaluacioneDto.id_lesion,
      id_usuario_registro: +createEvaluacioneDto.id_usuario_registro,
      id_medico_validador: +createEvaluacioneDto.id_medico_validador,
      prediccion_ia: createEvaluacioneDto.prediccion_ia ? +createEvaluacioneDto.prediccion_ia : undefined,
      diametro_mm: createEvaluacioneDto.diametro_mm ? +createEvaluacioneDto.diametro_mm : undefined,
      // Boolean conversion
      asimetria: createEvaluacioneDto.asimetria === 'true',
      bordes_irregulares: createEvaluacioneDto.bordes_irregulares === 'true',
      color_variable: createEvaluacioneDto.color_variable === 'true',
      evolucion_cambios: createEvaluacioneDto.evolucion_cambios === 'true',
      sintoma_sangrado: createEvaluacioneDto.sintoma_sangrado === 'true',
      sintoma_picazon: createEvaluacioneDto.sintoma_picazon === 'true',
      sintoma_dolor: createEvaluacioneDto.sintoma_dolor === 'true',
      sintoma_ulceracion: createEvaluacioneDto.sintoma_ulceracion === 'true',
      requiere_biopsia: createEvaluacioneDto.requiere_biopsia === 'true',
      fecha_evaluacion: createEvaluacioneDto.fecha_evaluacion ? new Date(createEvaluacioneDto.fecha_evaluacion) : undefined,
    };

    // 2. Get Patient CURP to organize file
    // Note: DTO has id_lesion. We need to find patient from lesion.
    // Assuming we can get patient ID from lesion or it's passed (it's not in CreateEvaluacioneDto usually, but linked via Lesion)
    // Let's assume we can fetch it. 
    // Actually, Lesion belongs to Patient.
    // We need to inject LesionesService? Or just use Prisma in EvaluacionService?
    // Let's do the move logic in Service for cleaner code, OR do it here.
    // Let's do it here to keep Service clean of file IO if possible, or pass the file path.

    // Wait! logic is complex. Let's simplify:
    // User wants folders by CURP.
    // We need to:
    // a) Get Lesion -> Get Patient -> Get CURP
    // b) Create folder `uploads/CURP/`
    // c) Move file `uploads/temp-xxx.jpg` to `uploads/CURP/timestamp.jpg`
    // d) Save new path to DB.

    // To do this, we need valid id_lesion check first.
    // Let's delegate this to the service? 
    // No, controller is fine for presentation/file handling.

    // We need LesionesService or just use Prisma? 
    // EvaluacionesService likely uses Prisma. Let's pass the temp path and let the Service handle the logic?
    // User asked "como puedo hacer...".
    // Let's implement full logic in Controller for visibility or Service. 
    // Let's put it in Service `createWithImage`.

    if (file) {
      dto.ruta_imagen = file.path; // Temporary, service will update it
    }

    return this.evaluacionesService.createWithImage(dto, file);
  }

  @Get()
  findAll(
    @Query('id_paciente') id_paciente?: string,
    @Query('id_lesion') id_lesion?: string,
  ) {
    return this.evaluacionesService.findAll(
      id_paciente ? +id_paciente : undefined,
      id_lesion ? +id_lesion : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.evaluacionesService.findOne(+id);
  }
}

