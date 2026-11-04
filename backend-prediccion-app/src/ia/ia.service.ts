import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { tipo_sexo } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
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
  escala?: { px_por_mm: number | null; ancho_campo_mm: number | null };
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
const POLITICAS = ['consulta', 'cribado'];

// El análisis en vivo y el guardado de una evaluación piden lo mismo: la
// respuesta se reutiliza si coinciden la foto y todos los datos enviados.
const CACHE_TTL_MS = 15 * 60_000;
const CACHE_MAX = 20;

function hashArchivo(ruta: string): string {
  return createHash('sha256').update(fs.readFileSync(ruta)).digest('hex');
}

/** Cliente de la API de IA (Fase 14: Fusión + QResNet-Hybrid). */
@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);
  private readonly politica = process.env.IA_POLITICA || undefined;
  private readonly cache = new Map<string, { resultado: ResultadoIA; vence: number }>();

  constructor(private readonly http: HttpService) {
    if (this.politica && !POLITICAS.includes(this.politica)) {
      throw new Error(`IA_POLITICA inválida: ${this.politica} (valores: ${POLITICAS.join(', ')})`);
    }
  }

  private leerCache(clave: string): ResultadoIA | null {
    const ahora = Date.now();
    for (const [k, v] of this.cache) if (v.vence <= ahora) this.cache.delete(k);
    return this.cache.get(clave)?.resultado ?? null;
  }

  private guardarCache(clave: string, resultado: ResultadoIA) {
    // Map conserva el orden de inserción: el primero es el más antiguo.
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
    this.cache.set(clave, { resultado, vence: Date.now() + CACHE_TTL_MS });
  }

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
    anchoCampoMm?: number;
    rutaImagenPrevia?: string | null;
    pxPorMmPrevia?: number | null;
  }): Promise<ResultadoIA> {
    const edad = IaService.edad(opciones.paciente.fecha_nacimiento, opciones.fechaReferencia);
    const campos: Record<string, string> = {
      sexo: SEXO_IA[opciones.paciente.sexo] ?? 'unknown',
      sitio: opciones.sitio || 'unknown',
      ...(edad !== null ? { edad: String(edad) } : {}),
      ...(this.politica ? { politica: this.politica } : {}),
      ...(opciones.anchoCampoMm ? { ancho_campo_mm: String(opciones.anchoCampoMm) } : {}),
      ...(opciones.rutaImagenPrevia && opciones.pxPorMmPrevia ? { px_por_mm_previa: String(opciones.pxPorMmPrevia) } : {}),
    };
    const clave = JSON.stringify([
      hashArchivo(opciones.rutaImagen),
      opciones.rutaImagenPrevia ? hashArchivo(opciones.rutaImagenPrevia) : null,
      Object.entries(campos).sort(),
    ]);
    const enCache = this.leerCache(clave);
    if (enCache) return enCache;

    const form = new FormData();
    form.append('image', fs.createReadStream(opciones.rutaImagen));
    for (const [campo, valor] of Object.entries(campos)) form.append(campo, valor);
    if (opciones.rutaImagenPrevia) form.append('imagen_previa', fs.createReadStream(opciones.rutaImagenPrevia));

    try {
      const respuesta = await firstValueFrom(this.http.post<ResultadoIA>(`${this.url()}/api/v2/predict`, form, {
        headers: form.getHeaders(),
        timeout: TIMEOUT_MS,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }));
      this.guardarCache(clave, respuesta.data);
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
