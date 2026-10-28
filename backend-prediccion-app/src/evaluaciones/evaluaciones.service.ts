import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, HttpException, Logger } from '@nestjs/common';
import { CreateEvaluacioneDto } from './dto/create-evaluacione.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { borrarSiExiste, carpetaPaciente, resolverRutaGuardada, rutaPublica } from '../archivos/archivos';
import { IaService, ResultadoIA } from '../ia/ia.service';
import { VALORES_SITIO } from '../ia/sitios';

/** Mapas de la IA guardados por evaluación (GET /evaluaciones/:id/mapa/:tipo). */
export const TIPOS_MAPA = {
  fusion: 'ruta_mapa_fusion',
  qresnet: 'ruta_mapa_qresnet',
  contorno: 'ruta_contorno_lesion',
} as const;
export type TipoMapa = keyof typeof TIPOS_MAPA;

/** Contexto clínico para el análisis en vivo: la lesión (si ya existe) o el paciente. */
export interface ContextoAnalisis {
  id_lesion?: number;
  id_paciente?: number;
  sitio_anatomico?: string;
}

@Injectable()
export class EvaluacionesService {
  private readonly logger = new Logger(EvaluacionesService.name);

  constructor(private prisma: PrismaService, private ia: IaService) { }

  /** Foto de la evaluación más reciente de la lesión (para el criterio E de evolución). */
  private async imagenPrevia(idLesion: number): Promise<string | null> {
    const previa = await this.prisma.evaluaciones.findFirst({
      where: { id_lesion: idLesion },
      orderBy: { fecha_evaluacion: 'desc' },
      select: { ruta_imagen: true },
    });
    return resolverRutaGuardada(previa?.ruta_imagen);
  }

  private validarSitio(sitio: string | undefined): string | undefined {
    if (sitio && !(VALORES_SITIO as string[]).includes(sitio)) {
      throw new BadRequestException(`sitio_anatomico debe ser uno de: ${VALORES_SITIO.join(', ')}`);
    }
    return sitio;
  }

  /**
   * Análisis en vivo (antes de guardar): la web y la app lo usan para mostrar el
   * resultado y prellenar los criterios ABCDE. No se guarda nada; la foto
   * temporal se borra.
   */
  async predictImageLive(imagePath: string, contexto: ContextoAnalisis) {
    try {
      let sitio = this.validarSitio(contexto.sitio_anatomico);
      let paciente;
      let rutaPrevia: string | null = null;
      if (contexto.id_lesion) {
        const lesion = await this.prisma.lesiones.findUnique({
          where: { id_lesion: contexto.id_lesion },
          include: { pacientes: true },
        });
        if (!lesion?.pacientes) throw new BadRequestException('La lesión especificada no existe.');
        paciente = lesion.pacientes;
        sitio = sitio ?? lesion.sitio_anatomico;
        rutaPrevia = await this.imagenPrevia(lesion.id_lesion);
      } else if (contexto.id_paciente) {
        paciente = await this.prisma.pacientes.findUnique({ where: { id_paciente: contexto.id_paciente } });
        if (!paciente) throw new BadRequestException('El paciente especificado no existe.');
      } else {
        throw new BadRequestException('Indique id_lesion o id_paciente para analizar la imagen.');
      }

      const resultado = await this.ia.analizar({
        rutaImagen: imagePath,
        paciente,
        sitio: sitio ?? 'unknown',
        rutaImagenPrevia: rutaPrevia,
      });
      return {
        success: true,
        // Valores para prellenar el formulario (el médico los confirma o corrige).
        data: {
          prediccion_ia: IaService.camposEvaluacion(resultado).prediccion_ia,
          ...IaService.sugerenciasAbcde(resultado),
        },
        explanation: resultado.mensaje,
        ia: resultado,
      };
    } finally {
      borrarSiExiste(imagePath);
    }
  }

  async createWithImage(dto: CreateEvaluacioneDto, file: Express.Multer.File | undefined) {
    try {
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

      // La probabilidad de la IA la calcula el backend; no se acepta del cliente.
      delete dto.prediccion_ia;
      let finalPath = dto.ruta_imagen;
      let camposIA = {};

      if (file) {
        // Carpeta por id de paciente (antes por CURP) y nombre aleatorio que
        // asigna multer (antes se usaba el nombre que mandaba el cliente, que
        // podia contener ../ y escribir fuera de uploads).
        const rutaPrevia = await this.imagenPrevia(lesion.id_lesion);
        const newPath = path.join(carpetaPaciente(paciente.id_paciente), file.filename);
        fs.renameSync(file.path, newPath);
        finalPath = rutaPublica(newPath);

        // Si la IA falla, la evaluación se guarda igual, sin resultado de IA
        // (decision_ia queda en null y la app lo indica).
        try {
          const resultado: ResultadoIA = await this.ia.analizar({
            rutaImagen: newPath,
            paciente,
            sitio: lesion.sitio_anatomico,
            fechaReferencia: dto.fecha_evaluacion ?? new Date(),
            rutaImagenPrevia: rutaPrevia,
          });
          camposIA = { ...IaService.camposEvaluacion(resultado), ...IaService.guardarMapas(resultado, paciente.id_paciente) };
        } catch (err: any) {
          this.logger.error(`Evaluación guardada sin resultado de IA: ${err?.message}`);
        }
      }

      // Los criterios ABCDE que se guardan son los que marca el médico (el
      // formulario se prellena con la sugerencia de la IA del análisis en vivo).
      return await this.prisma.evaluaciones.create({
        data: {
          ...dto,
          ...camposIA,
          ruta_imagen: finalPath,
        } as Prisma.evaluacionesUncheckedCreateInput,
      });

    } catch (error) {
      if (file) borrarSiExiste(file.path);
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

  /** Ruta en disco de un mapa de la IA de la evaluación (o null si no existe). */
  async rutaMapa(id: number, tipo: TipoMapa): Promise<string | null> {
    const evaluacion = await this.findOne(id);
    return resolverRutaGuardada(evaluacion[TIPOS_MAPA[tipo]]);
  }

  private handleDBExceptions(error: any): never {
    if (error instanceof HttpException) throw error;
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
    if (error instanceof Prisma.PrismaClientValidationError) {
      throw new BadRequestException('Datos de la evaluación inválidos.');
    }

    this.logger.error(error);
    throw new InternalServerErrorException('Error inesperado al procesar la evaluación');
  }

}
