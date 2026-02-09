import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { LesionesService } from './lesiones.service';
import { CreateLesioneDto } from './dto/create-lesione.dto';

@Controller('lesiones')
export class LesionesController {
  constructor(private readonly lesionesService: LesionesService) {}

  @Post()
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
}
