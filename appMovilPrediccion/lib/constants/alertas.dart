/// Datos clínicos a tener presentes junto con el resultado de la IA. Son reglas
/// simples sobre lo que captura el personal: no cambian la decisión de los
/// modelos, que no usan estos datos. Las mismas que la web
/// (frontMelanoma/src/constants/alertas.js).
List<String> alertasClinicas(
  Map<String, dynamic>? paciente,
  Map<String, dynamic>? evaluacion,
) {
  final diametro = num.tryParse('${evaluacion?['diametro_mm'] ?? ''}');
  return [
    if (evaluacion?['sintoma_sangrado'] == true) 'La lesión presenta sangrado.',
    if (evaluacion?['sintoma_ulceracion'] == true) 'La lesión presenta ulceración.',
    if (evaluacion?['evolucion_cambios'] == true) 'Se reportan cambios en la lesión.',
    if (diametro != null && diametro > 6) 'Diámetro mayor de 6 mm.',
    if (paciente?['antecedentes_familiares'] == true) 'Antecedentes familiares.',
    if (paciente?['historial_cancer_previo'] == true) 'Cáncer previo.',
    if (paciente?['inmunosuprimido'] == true) 'Paciente inmunosuprimido.',
  ];
}
