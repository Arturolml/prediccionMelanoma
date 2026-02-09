import { Injectable } from '@nestjs/common';
import { CreatePacienteDto } from './dto/create-paciente.dto';
import { UpdatePacienteDto } from './dto/update-paciente.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PacientesService {

  constructor(private prisma: PrismaService) { }

  create(dto: CreatePacienteDto) {
    return this.prisma.pacientes.create({
      data: {
        nombres: dto.nombres,
        apellido_paterno: dto.apellido_paterno,
        apellido_materno: dto.apellido_materno,
        curp: dto.curp,
        sexo: dto.sexo,
        fecha_nacimiento: dto.fecha_nacimiento,
      }
    })
  }

  async findAll() {
    return this.prisma.pacientes.findMany();
    orderBy: {
      apellido_paterno: 'asc'
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} paciente`;
  }

  update(id: number, updatePacienteDto: UpdatePacienteDto) {
    return `This action updates a #${id} paciente`;
  }

  remove(id: number) {
    return `This action removes a #${id} paciente`;
  }
}
