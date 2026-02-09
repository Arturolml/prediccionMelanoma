import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { CreateEvaluacioneDto } from './dto/create-evaluacione.dto';
import { UpdateEvaluacioneDto } from './dto/update-evaluacione.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class EvaluacionesService {

  constructor(private prisma: PrismaService) { }


  async create(createEvaluacioneDto: CreateEvaluacioneDto) {
    try {
      return await this.prisma.evaluaciones.create({
        data: {
          ...createEvaluacioneDto,
        } as Prisma.evaluacionesUncheckedCreateInput,
      });
    } catch (error) {
      this.handleDBExceptions(error);
    }

  }

  async findAll(id_paciente?: number, id_lesion?: number) {
    const where: Prisma.evaluacionesWhereInput = {};

    if (id_lesion) {
      where.id_lesion = id_lesion;
    } else if (id_paciente) {
      where.lesiones = {
        id_paciente: id_paciente,
      };
    }

    return await this.prisma.evaluaciones.findMany({
      where,
      orderBy: {
        id_evaluacion: 'desc',
      },
      include: {
        lesiones: true,
      }
    });
  }

  async findOne(id: number) {
    const evaluacion = await this.prisma.evaluaciones.findUnique({
      where: { id_evaluacion: id },
      include: {
        lesiones: true
      }
    });

    if (!evaluacion) {
      throw new NotFoundException(`Evaluación con ID ${id} no encontrada`);
    }

    return evaluacion;
  }

  private handleDBExceptions(error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        throw new BadRequestException(
          'Error de referencia: Uno de los IDs proporcionados (Usuario, Médico o Lesión) no existe.'
        );
      }
      if (error.code === 'P2002') {
        throw new BadRequestException('Ya existe un registro con estos datos únicos.');
      }
    }

    console.error(error);
    throw new InternalServerErrorException('Error inesperado al procesar la evaluación');
  }

} 
