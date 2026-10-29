/**
 * Sitios anatómicos con que se entrenó el modelo de Fusión (los mismos 16 que
 * acepta la API de IA en `sitio`; ver api-prediccion-ai/README.md). La web y la
 * app móvil muestran las etiquetas en español y guardan el valor.
 */
export const SITIOS_ANATOMICOS = {
  abdomen: 'Abdomen',
  acral: 'Palma o planta (acral)',
  back: 'Espalda',
  chest: 'Pecho',
  ear: 'Oreja',
  face: 'Cara',
  foot: 'Pie',
  genital: 'Genital',
  hand: 'Mano',
  'head/neck': 'Cabeza y cuello',
  'lower extremity': 'Pierna (extremidad inferior)',
  neck: 'Cuello',
  scalp: 'Cuero cabelludo',
  trunk: 'Tronco (sin especificar)',
  'upper extremity': 'Brazo (extremidad superior)',
  unknown: 'No especificado',
} as const;

export type SitioAnatomico = keyof typeof SITIOS_ANATOMICOS;
export const VALORES_SITIO = Object.keys(SITIOS_ANATOMICOS) as SitioAnatomico[];
