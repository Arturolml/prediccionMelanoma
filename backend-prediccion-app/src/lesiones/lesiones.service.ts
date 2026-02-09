import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateLesioneDto } from './dto/create-lesione.dto';
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
}
