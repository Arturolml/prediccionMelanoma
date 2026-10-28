import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateLesioneDto } from './dto/create-lesione.dto';
import { UpdateLesioneDto } from './dto/update-lesione.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class LesionesService {

  constructor(private prisma: PrismaService) { }

  async create(createLesioneDto: CreateLesioneDto) {
    return await this.prisma.lesiones.create({
      data: {
        ...createLesioneDto,
      }
    });
  }

  async findAll(id_paciente?: number) {
    return await this.prisma.lesiones.findMany({
      where: id_paciente ? { id_paciente } : {},
      orderBy: {
        id_lesion: 'desc',
      }
    });
  }

  async findOne(id: number) {
    const lesion = await this.prisma.lesiones.findUnique({
      where: { id_lesion: id }
    });

    if (!lesion) {
      throw new NotFoundException(`Lesión con ID ${id} no encontrada`);
    }

    return lesion;
  }

  async update(id: number, dto: UpdateLesioneDto) {
    await this.findOne(id);
    // Campos explícitos: el ValidationPipe global no descarta propiedades no
    // declaradas, así que pasar el dto completo permitiría cambiar id_paciente.
    return await this.prisma.lesiones.update({
      where: { id_lesion: id },
      data: {
        zona_cuerpo: dto.zona_cuerpo,
        sitio_anatomico: dto.sitio_anatomico,
        fecha_deteccion: dto.fecha_deteccion,
        notas_ubicacion: dto.notas_ubicacion,
      },
    });
  }
}
