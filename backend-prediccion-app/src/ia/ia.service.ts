import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { tipo_sexo } from '@prisma/client';
import { randomUUID } from 'crypto';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import { firstValueFrom } from 'rxjs';
import { carpetaPaciente, rutaPublica } from '../archivos/archivos';
import { SitioAnatomico } from './sitios';

/** Respuesta de POST /api/v2/predict de la API de IA (ver api-prediccion-ai/README.md). */
export interface ResultadoIA {
  version_modelos: string;
  p_malignant: number;
  politica: string;
  decision: 'sospecha' | 'sin_sospecha' | 'derivar';
  revisar_caso: boolean;
  coinciden: boolean;
  mensaje: string;
  fusion: { prob_maligno: number; umbral: number; sospecha: boolean; [k: string]: unknown };
  qresnet: { prob_maligno: number; umbral: number; sospecha: boolean; [k: string]: unknown };
  abcde: {
    asimetria: boolean | null;
    bordes_irregulares: boolean | null;
    color_variable: boolean | null;
    diametro_mm: number | null;
    [k: string]: unknown;
  };
  imagenes?: { mapa_fusion_png?: string; mapa_qresnet_png?: string; contorno_lesion_png?: string | null };
  [k: string]: unknown;
}

export interface PacienteIA {
  fecha_nacimiento: Date;
  sexo: tipo_sexo;
}

const SEXO_IA: Record<tipo_sexo, string> = { M: 'male', F: 'female', Otro: 'unknown' };
const TIMEOUT_MS = 60_000;

/** Cliente de la API de IA (Fase 14: Fusión + QResNet-Hybrid). */
@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);

  constructor(private readonly http: HttpService) { }

  private url(): string {
    return (process.env.IA_API_URL || 'http://api_ia:8000').replace(/\/+$/, '');
  }

  /** Años cumplidos a la fecha de referencia (o null si no se puede calcular). */
  static edad(fechaNacimiento: Date | null | undefined, fechaReferencia: Date = new Date()): number | null {
    if (!fechaNacimiento) return null;
    const n = new Date(fechaNacimiento);
    if (isNaN(n.getTime())) return null;
    let edad = fechaReferencia.getUTCFullYear() - n.getUTCFullYear();
    const antesDelCumple = fechaReferencia.getUTCMonth() < n.getUTCMonth()
      || (fechaReferencia.getUTCMonth() === n.getUTCMonth() && fechaReferencia.getUTCDate() < n.getUTCDate());
    if (antesDelCumple) edad -= 1;
    return edad >= 0 && edad <= 120 ? edad : null;
  }

  /**
   * Analiza una foto con los dos modelos. Lanza BadRequestException si la IA
   * rechaza los datos y ServiceUnavailableException si no responde.
   */
  async analizar(opciones: {
    rutaImagen: string;
    paciente: PacienteIA;
    sitio: SitioAnatomico | string;
    fechaReferencia?: Date;
    rutaImagenPrevia?: string | null;
  }): Promise<ResultadoIA> {
    const form = new FormData();
    form.append('image', fs.createReadStream(opciones.rutaImagen));
    const edad = IaService.edad(opciones.paciente.fecha_nacimiento, opciones.fechaReferencia);
    if (edad !== null) form.append('edad', String(edad));
    form.append('sexo', SEXO_IA[opciones.paciente.sexo] ?? 'unknown');
    form.append('sitio', opciones.sitio || 'unknown');
    if (opciones.rutaImagenPrevia) form.append('imagen_previa', fs.createReadStream(opciones.rutaImagenPrevia));

    try {
      const respuesta = await firstValueFrom(this.http.post<ResultadoIA>(`${this.url()}/api/v2/predict`, form, {
        headers: form.getHeaders(),
        timeout: TIMEOUT_MS,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }));
      return respuesta.data;
    } catch (error: any) {
      const estado = error?.response?.status;
      const detalle = error?.response?.data?.error;
      this.logger.error(`La IA respondió ${estado ?? 'sin respuesta'}: ${detalle ?? error?.message}`);
      if (estado === 400) throw new BadRequestException(`La IA rechazó los datos: ${detalle}`);
      throw new ServiceUnavailableException('No se pudo analizar la imagen. Verifique que el servicio de IA esté encendido.');
    }
  }

  /** Campos de la tabla evaluaciones que vienen de la IA (sin las imágenes). */
  static camposEvaluacion(r: ResultadoIA) {
    const { imagenes: _imagenes, ...resultado } = r;
    return {
      prediccion_ia: Number((r.fusion.prob_maligno * 100).toFixed(2)),
      prob_qresnet: Number((r.qresnet.prob_maligno * 100).toFixed(2)),
      decision_ia: r.decision,
      ia_revisar_caso: r.revisar_caso,
      version_modelos_ia: r.version_modelos,
      resultado_ia: resultado as object,
    };
  }

  /**
   * Criterios ABCDE sugeridos por la IA para prellenar el formulario. El médico
   * los confirma o corrige: lo que se guarda es lo que él marca. El diámetro
   * solo viene en mm si la foto tiene escala.
   */
  static sugerenciasAbcde(r: ResultadoIA) {
    const a = r.abcde;
    const sugerencias: Record<string, boolean | number> = {};
    if (typeof a.asimetria === 'boolean') sugerencias.asimetria = a.asimetria;
    if (typeof a.bordes_irregulares === 'boolean') sugerencias.bordes_irregulares = a.bordes_irregulares;
    if (typeof a.color_variable === 'boolean') sugerencias.color_variable = a.color_variable;
    if (typeof a.diametro_mm === 'number') sugerencias.diametro_mm = Number(a.diametro_mm.toFixed(1));
    return sugerencias;
  }

  /** Guarda los mapas (PNG en base64) en la carpeta del paciente y devuelve sus rutas. */
  static guardarMapas(r: ResultadoIA, idPaciente: number) {
    const dir = carpetaPaciente(idPaciente);
    const base = randomUUID();
    const guardar = (b64: string | null | undefined, sufijo: string) => {
      if (!b64) return null;
      const ruta = path.join(dir, `${base}_${sufijo}.png`);
      fs.writeFileSync(ruta, Buffer.from(b64, 'base64'));
      return rutaPublica(ruta);
    };
    return {
      ruta_mapa_fusion: guardar(r.imagenes?.mapa_fusion_png, 'mapa_fusion'),
      ruta_mapa_qresnet: guardar(r.imagenes?.mapa_qresnet_png, 'mapa_qresnet'),
      ruta_contorno_lesion: guardar(r.imagenes?.contorno_lesion_png, 'contorno'),
    };
  }
}
