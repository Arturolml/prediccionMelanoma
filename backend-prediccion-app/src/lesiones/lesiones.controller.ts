import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { LesionesService } from './lesiones.service';
import { CreateLesioneDto } from './dto/create-lesione.dto';
import { UpdateLesioneDto } from './dto/update-lesione.dto';

@Controller('lesiones')
export class LesionesController {
  constructor(private readonly lesionesService: LesionesService) {}

  @Post()
  create(@Body() createLesioneDto: CreateLesioneDto) {
    return this.lesionesService.create(createLesioneDto);
  }

  @Get()
  findAll() {
    return this.lesionesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lesionesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLesioneDto: UpdateLesioneDto) {
    return this.lesionesService.update(+id, updateLesioneDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.lesionesService.remove(+id);
  }
}
