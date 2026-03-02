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
        fototipo_fitzpatrick: dto.fototipo_fitzpatrick,
        antecedentes_familiares: dto.antecedentes_familiares,
        notas_antecedentes: dto.notas_antecedentes,
        historial_cancer_previo: dto.historial_cancer_previo,
        inmunosuprimido: dto.inmunosuprimido,
        id_usuario_registro: dto.id_usuario_registro
      }
    })
  }

  async findAll(user?: any) {
    let whereClause: any = {};

    // Si el usuario es médico, solo debe ver los pacientes que él mismo registró
    if (user && user.rol === 'medico') {
      whereClause.id_usuario_registro = user.userId;
    }
    // (Si es admin, no entra al IF y por tanto ve todos)

    return this.prisma.pacientes.findMany({
      where: whereClause,
      orderBy: {
        apellido_paterno: 'asc'
      }
    });
  }

  async findOne(id: number) {
    const paciente = await this.prisma.pacientes.findUnique({
      where: { id_paciente: id }
    });
    return paciente;
  }

  async update(id: number, updatePacienteDto: UpdatePacienteDto) {
    return this.prisma.pacientes.update({
      where: { id_paciente: id },
      data: updatePacienteDto
    });
  }


}
