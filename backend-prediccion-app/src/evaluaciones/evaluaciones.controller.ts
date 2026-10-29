import { Controller, Get, Post, Body, Param, Query, UseInterceptors, UploadedFile, UseGuards, BadRequestException, NotFoundException, Res, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { opcionesSubidaImagen, resolverRutaGuardada } from '../archivos/archivos';
import { EvaluacionesService, TIPOS_MAPA, TipoMapa } from './evaluaciones.service';
import { PacientesService } from '../pacientes/pacientes.service';
import { CreateEvaluacioneDto } from './dto/create-evaluacione.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const DIAGNOSTICOS = ['Benigno', 'Sospechoso', 'Maligno_Melanoma', 'Indeterminado'];

function entero(valor: string | undefined): number | undefined {
  const n = Number(valor);
  return valor && Number.isInteger(n) && n > 0 ? n : undefined;
}

function numero(valor: string | undefined): number | undefined {
  const n = Number(valor);
  return valor && Number.isFinite(n) ? n : undefined;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('evaluaciones')
export class EvaluacionesController {
  constructor(
    private readonly evaluacionesService: EvaluacionesService,
    private readonly pacientesService: PacientesService
  ) { }

  /**
   * Análisis en vivo de una foto, antes de guardar la evaluación. Campos del
   * formulario: imagen (archivo) e id_lesion o id_paciente; sitio_anatomico es
   * opcional (por defecto, el de la lesión). La IA usa edad, sexo y sitio.
   */
  @Post('predict-live')
  @Roles('medico', 'enfermero')
  @UseInterceptors(FileInterceptor('imagen', opcionesSubidaImagen('temp')))
  async predictLive(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Record<string, string>,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó una imagen para analizar.');
    }
    return this.evaluacionesService.predictImageLive(file.path, {
      id_lesion: entero(body.id_lesion),
      id_paciente: entero(body.id_paciente),
      sitio_anatomico: body.sitio_anatomico || undefined,
    });
  }

  @Post()
  @Roles('medico', 'enfermero')
  // Se guarda primero en uploads/temp; el servicio la mueve a la carpeta del paciente.
  @UseInterceptors(FileInterceptor('imagen', opcionesSubidaImagen('temp')))
  async create(
    @Req() req: any,
    @Body() body: Record<string, string>, // multipart/form-data: todo llega como texto
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('Falta la imagen de la evaluación.');
    }
    const idLesion = entero(body.id_lesion);
    if (!idLesion) {
      throw new BadRequestException('Falta id_lesion.');
    }
    const usuario = req.user;
    // Solo los campos que llena el usuario: el resultado de la IA lo calcula el
    // backend (antes se copiaba el formulario completo, con lo que el cliente
    // podía escribir cualquier columna). Quién registra sale del token, no del
    // formulario (la app móvil mandaba 1 fijo).
    const dto: CreateEvaluacioneDto = {
      id_lesion: idLesion,
      id_usuario_registro: +usuario.userId,
      id_medico_validador: usuario.rol === 'medico' ? +usuario.userId : undefined,
      ruta_imagen: file.path, // temporal: el servicio la mueve a la carpeta del paciente
      diametro_mm: numero(body.diametro_mm),
      asimetria: body.asimetria === 'true',
      bordes_irregulares: body.bordes_irregulares === 'true',
      color_variable: body.color_variable === 'true',
      evolucion_cambios: body.evolucion_cambios === 'true',
      sintoma_sangrado: body.sintoma_sangrado === 'true',
      sintoma_picazon: body.sintoma_picazon === 'true',
      sintoma_dolor: body.sintoma_dolor === 'true',
      sintoma_ulceracion: body.sintoma_ulceracion === 'true',
      requiere_biopsia: body.requiere_biopsia === 'true',
      diagnostico_medico: DIAGNOSTICOS.includes(body.diagnostico_medico) ? body.diagnostico_medico : undefined,
      notas_medico: body.notas_medico || undefined,
      fecha_evaluacion: body.fecha_evaluacion ? new Date(body.fecha_evaluacion) : undefined,
    };
    return this.evaluacionesService.createWithImage(dto, file);
  }

  @Get()
  findAll(
    @Query('id_paciente') id_paciente?: string,
    @Query('id_lesion') id_lesion?: string,
  ) {
    return this.evaluacionesService.findAll(
      id_paciente ? +id_paciente : undefined,
      id_lesion ? +id_lesion : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.evaluacionesService.findOne(+id);
  }

  /** Foto de la evaluación (antes se servía pública en /uploads, con el CURP en la ruta). */
  @Get(':id/imagen')
  async imagen(@Param('id') id: string, @Res() res: Response) {
    const evaluacion = await this.evaluacionesService.findOne(+id);
    const ruta = resolverRutaGuardada(evaluacion.ruta_imagen);
    if (!ruta) throw new NotFoundException('La evaluación no tiene imagen disponible');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(ruta);
  }

  /** Mapa de la IA: fusion o qresnet (Grad-CAM) o contorno (lesión segmentada). */
  @Get(':id/mapa/:tipo')
  async mapa(@Param('id') id: string, @Param('tipo') tipo: string, @Res() res: Response) {
    if (!(tipo in TIPOS_MAPA)) throw new NotFoundException(`Tipo de mapa desconocido: ${tipo}`);
    const ruta = await this.evaluacionesService.rutaMapa(+id, tipo as TipoMapa);
    if (!ruta) throw new NotFoundException('La evaluación no tiene ese mapa');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(ruta);
  }
}

