import { Controller, Get, Post, Body, Patch, Param, NotFoundException, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PacientesService } from './pacientes.service';
import { CreatePacienteDto } from './dto/create-paciente.dto';
import { UpdatePacienteDto } from './dto/update-paciente.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pacientes')
export class PacientesController {
  constructor(private readonly pacientesService: PacientesService) { }

  @Post()
  @Roles('medico', 'enfermero')
  create(@Req() req: any, @Body() createPacienteDto: CreatePacienteDto) {
    if (req.user && req.user.userId) {
      createPacienteDto.id_usuario_registro = +req.user.userId;
    }
    return this.pacientesService.create(createPacienteDto);
  }

  @Get()
  async findAll(@Req() req: any) {
    return this.pacientesService.findAll(req.user);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const paciente = await this.pacientesService.findOne(+id);
    if (!paciente) throw new NotFoundException('Paciente no encontrado');
    return paciente;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePacienteDto: UpdatePacienteDto) {
    return this.pacientesService.update(+id, updatePacienteDto);
  }


}
