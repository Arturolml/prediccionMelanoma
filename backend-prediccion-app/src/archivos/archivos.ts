import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';

/** Carpeta de las fotos de las evaluaciones y de los mapas de la IA. Ya no se
 * sirve como estática: las imágenes se entregan por endpoints con sesión
 * (GET /evaluaciones/:id/imagen y /evaluaciones/:id/mapa/:tipo). */
export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
export const MAX_IMAGEN_BYTES = 20 * 1024 * 1024;

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/** Opciones de multer para subir una foto: nombre aleatorio (nunca el nombre
 * que manda el cliente), solo JPEG/PNG/WEBP y como máximo 20 MB. */
export function opcionesSubidaImagen(subcarpeta: string) {
  const destino = path.join(UPLOADS_DIR, subcarpeta);
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        fs.mkdirSync(destino, { recursive: true });
        cb(null, destino);
      },
      filename: (_req, file, cb) => cb(null, `${randomUUID()}${EXTENSIONES[file.mimetype]}`),
    }),
    limits: { fileSize: MAX_IMAGEN_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (EXTENSIONES[file.mimetype]) cb(null, true);
      else cb(new BadRequestException('La imagen debe ser JPEG, PNG o WEBP'), false);
    },
  };
}

/** Carpeta de un paciente dentro de uploads (por id, no por CURP). */
export function carpetaPaciente(idPaciente: number): string {
  const dir = path.join(UPLOADS_DIR, `p${idPaciente}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Ruta pública guardada en la base de datos (p. ej. /uploads/p3/x.jpg) para un
 * archivo dentro de UPLOADS_DIR. */
export function rutaPublica(rutaAbsoluta: string): string {
  return '/uploads/' + path.relative(UPLOADS_DIR, rutaAbsoluta).split(path.sep).join('/');
}

/** Ruta absoluta de un archivo guardado en la base de datos como /uploads/...;
 * null si apunta fuera de UPLOADS_DIR o no existe. */
export function resolverRutaGuardada(rutaGuardada: string | null | undefined): string | null {
  if (!rutaGuardada) return null;
  const relativa = rutaGuardada.replace(/\\/g, '/').replace(/^\/?uploads\//, '');
  const absoluta = path.resolve(UPLOADS_DIR, relativa);
  if (!absoluta.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(absoluta)) return null;
  return absoluta;
}

export function borrarSiExiste(ruta: string | undefined | null) {
  if (ruta && fs.existsSync(ruta)) {
    try {
      fs.unlinkSync(ruta);
    } catch {
      // archivo temporal: si no se puede borrar no se interrumpe la petición
    }
  }
}
