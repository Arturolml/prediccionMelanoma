import { Injectable } from '@nestjs/common';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

// Campos que se devuelven al cliente: nunca password_hash.
const SIN_HASH = {
  id_usuario: true, nombre_completo: true, email: true, rol: true, cedula_profesional: true,
  telefono_contacto: true, activo: true, fecha_creacion: true,
} as const;

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
      },
      select: SIN_HASH,
    })
  }

  async findAll() {
    return this.prisma.usuarios_sistema.findMany({ select: SIN_HASH });
  }

  async findOne(id: number) {
    const usuario = await this.prisma.usuarios_sistema.findUnique({
      where: { id_usuario: id }
    });
    if (!usuario) return null;
    const { password_hash, ...result } = usuario;
    return result;
  }

  async update(id: number, dto: UpdateUsuarioDto) {
    const data: any = { ...dto };
    // El hash solo se calcula aqui: nunca se acepta del cliente (la web lo
    // mandaba como password_hash y quedaba guardada la contrasena en claro).
    delete data.password_hash;
    if (data.password) {
      data.password_hash = await bcrypt.hash(data.password, 10);
      delete data.password;
    }
    return this.prisma.usuarios_sistema.update({
      where: { id_usuario: id },
      data,
      select: SIN_HASH,
    });
  }

  async findOneByEmail(email: string) {
    return this.prisma.usuarios_sistema.findUnique({
      where: { email },
    });
  }

  async toggleStatus(id: number, activo: boolean) {
    return this.prisma.usuarios_sistema.update({
      where: { id_usuario: id },
      data: { activo },
      select: SIN_HASH,
    });
  }
}
