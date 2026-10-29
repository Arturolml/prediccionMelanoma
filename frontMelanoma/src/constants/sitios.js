// Sitios anatómicos con que se entrenó el modelo de Fusión (los mismos valores
// que valida el backend en src/ia/sitios.ts). Se muestra la etiqueta y se
// guarda el valor.
export const SITIOS_ANATOMICOS = [
    { valor: 'back', etiqueta: 'Espalda' },
    { valor: 'chest', etiqueta: 'Pecho' },
    { valor: 'abdomen', etiqueta: 'Abdomen' },
    { valor: 'trunk', etiqueta: 'Tronco (sin especificar)' },
    { valor: 'upper extremity', etiqueta: 'Brazo (extremidad superior)' },
    { valor: 'lower extremity', etiqueta: 'Pierna (extremidad inferior)' },
    { valor: 'hand', etiqueta: 'Mano' },
    { valor: 'foot', etiqueta: 'Pie' },
    { valor: 'acral', etiqueta: 'Palma o planta (acral)' },
    { valor: 'face', etiqueta: 'Cara' },
    { valor: 'ear', etiqueta: 'Oreja' },
    { valor: 'scalp', etiqueta: 'Cuero cabelludo' },
    { valor: 'neck', etiqueta: 'Cuello' },
    { valor: 'head/neck', etiqueta: 'Cabeza y cuello' },
    { valor: 'genital', etiqueta: 'Genital' },
    { valor: 'unknown', etiqueta: 'No especificado' },
];

export const etiquetaSitio = (valor) =>
    SITIOS_ANATOMICOS.find(s => s.valor === valor)?.etiqueta || 'No especificado';
