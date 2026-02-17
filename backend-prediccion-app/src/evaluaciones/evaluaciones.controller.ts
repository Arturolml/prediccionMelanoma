import { Controller, Get, Post, Body, Param, Query, UseInterceptors, UploadedFile, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { EvaluacionesService } from './evaluaciones.service';
import { CreateEvaluacioneDto } from './dto/create-evaluacione.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('evaluaciones')
export class EvaluacionesController {
  constructor(private readonly evaluacionesService: EvaluacionesService) { }

  @Post()
  @Roles('medico', 'enfermero')
  create(@Body() createEvaluacioneDto: CreateEvaluacioneDto) {
    return this.evaluacionesService.create(createEvaluacioneDto);
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
  @Post('upload')
  @Roles('medico', 'enfermero')
  @UseInterceptors(FileInterceptor('imagen', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      }
    })
  }))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    return {
      url: `/uploads/${file.filename}`
    };
  }
}
