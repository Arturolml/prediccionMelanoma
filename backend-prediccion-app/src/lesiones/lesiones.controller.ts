import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UpdateLesioneDto } from './dto/update-lesione.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LesionesService } from './lesiones.service';
import { CreateLesioneDto } from './dto/create-lesione.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lesiones')
export class LesionesController {
  constructor(private readonly lesionesService: LesionesService) {}

  @Post()
  @Roles('medico', 'enfermero')
  create(@Body() createLesioneDto: CreateLesioneDto) {
    return this.lesionesService.create(createLesioneDto);
  }

  @Get()
  findAll(@Query('id_paciente') id_paciente?: string) {
    return this.lesionesService.findAll(id_paciente ? +id_paciente : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lesionesService.findOne(+id);
  }

  // Sobre todo para asignar el sitio anatómico a las lesiones anteriores a la
  // Fase 14 (quedaron en 'unknown').
  @Patch(':id')
  @Roles('medico', 'enfermero')
  update(@Param('id') id: string, @Body() dto: UpdateLesioneDto) {
    return this.lesionesService.update(+id, dto);
  }
}
