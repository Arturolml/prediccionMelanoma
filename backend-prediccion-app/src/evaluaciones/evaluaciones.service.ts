import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { CreateEvaluacioneDto } from './dto/create-evaluacione.dto';
import { UpdateEvaluacioneDto } from './dto/update-evaluacione.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

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

  async createWithImage(dto: CreateEvaluacioneDto, file: Express.Multer.File | undefined) {
    try {
      // 1. Check if lesion exists to get Patient info
      const lesion = await this.prisma.lesiones.findUnique({
        where: { id_lesion: dto.id_lesion },
        include: { pacientes: true }
      });

      if (!lesion) {
        throw new BadRequestException('La lesión especificada no existe.');
      }

      const paciente = lesion.pacientes;
      if (!paciente) {
        throw new BadRequestException('La lesión no tiene un paciente asociado válido.');
      }

      // 2. Process File if exists
      let finalPath = dto.ruta_imagen; // If no file, keep original (maybe URL)

      if (file) {
        const curp = paciente.curp;
        // Sanitized CURP for folder name
        const safeCurp = curp.replace(/[^a-zA-Z0-9]/g, '');

        const uploadDir = `./uploads/${safeCurp}`;
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const newFilename = `${Date.now()}-${file.originalname}`;
        const newPath = path.join(uploadDir, newFilename);

        // Move file
        fs.renameSync(file.path, newPath);

        // Store relative path for URL access (assuming static serve points to ./uploads)
        // ServeStatic: rootPath: ./uploads, serveRoot: /uploads
        // So URL should be /uploads/CURP/filename
        finalPath = `/uploads/${safeCurp}/${newFilename}`;
      }

      // 3. Save to DB
      return await this.prisma.evaluaciones.create({
        data: {
          ...dto,
          ruta_imagen: finalPath,
        } as Prisma.evaluacionesUncheckedCreateInput,
      });

    } catch (error) {
      // Cleanup temp file if error
      if (file && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch (e) { }
      }
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
