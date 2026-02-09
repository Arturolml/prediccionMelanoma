import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { EvaluacionesService } from './evaluaciones.service';
import { CreateEvaluacioneDto } from './dto/create-evaluacione.dto';

@Controller('evaluaciones')
export class EvaluacionesController {
  constructor(private readonly evaluacionesService: EvaluacionesService) { }

  @Post()
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
}
