import { Injectable } from '@nestjs/common';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsuariosService {

  constructor(private prisma: PrismaService) { }

  async create(dto: CreateUsuarioDto) {

    const hash = await bcrypt.hash(dto.password, 10);
    return this.prisma.usuarios_sistema.create({
      data: {
        nombre_completo: dto.nombre_completo,
        email: dto.email,
        password_hash: hash,
        rol: dto.rol,
        cedula_profesional: dto.cedula_profesional,
        telefono_contacto: dto.telefono_contacto
      }
    })
  }

  async findAll() {
    return this.prisma.usuarios_sistema.findMany();
  }

  findOne(id: number) {
    return `This action returns a #${id} usuario`;
  }

  update(id: number, updateUsuarioDto: UpdateUsuarioDto) {
    return `This action updates a #${id} usuario`;
  }

  remove(id: number) {
    return `This action removes a #${id} usuario`;
  }
}
