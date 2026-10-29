/// Sitios anatómicos con que se entrenó el modelo de Fusión (los mismos valores
/// que valida el backend en src/ia/sitios.ts). Se muestra la etiqueta y se
/// guarda el valor.
const List<MapEntry<String, String>> sitiosAnatomicos = [
  MapEntry('back', 'Espalda'),
  MapEntry('chest', 'Pecho'),
  MapEntry('abdomen', 'Abdomen'),
  MapEntry('trunk', 'Tronco (sin especificar)'),
  MapEntry('upper extremity', 'Brazo (extremidad superior)'),
  MapEntry('lower extremity', 'Pierna (extremidad inferior)'),
  MapEntry('hand', 'Mano'),
  MapEntry('foot', 'Pie'),
  MapEntry('acral', 'Palma o planta (acral)'),
  MapEntry('face', 'Cara'),
  MapEntry('ear', 'Oreja'),
  MapEntry('scalp', 'Cuero cabelludo'),
  MapEntry('neck', 'Cuello'),
  MapEntry('head/neck', 'Cabeza y cuello'),
  MapEntry('genital', 'Genital'),
  MapEntry('unknown', 'No especificado'),
];

String etiquetaSitio(String? valor) => sitiosAnatomicos
    .firstWhere(
      (s) => s.key == valor,
      orElse: () => const MapEntry('unknown', 'No especificado'),
    )
    .value;
