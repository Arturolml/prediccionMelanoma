class Evaluation {
  final int? id;
  final int? idLesion;
  final int? idUsuarioRegistro;
  final int? idMedicoValidador;
  final String rutaImagen;
  final double? prediccionIa;
  final bool? asimetria;
  final bool? bordesIrregulares;
  final bool? colorVariable;
  final double? diametroMm;
  final bool? evolucionCambios;
  final bool? sintomaSangrado;
  final bool? sintomaPicazon;
  final bool? sintomaDolor;
  final bool? sintomaUlceracion;
  final String? diagnosticoMedico;
  final String? notasMedico;
  final bool? requiereBiopsia;

  Evaluation({
    this.id,
    this.idLesion,
    this.idUsuarioRegistro,
    this.idMedicoValidador,
    required this.rutaImagen,
    this.prediccionIa,
    this.asimetria,
    this.bordesIrregulares,
    this.colorVariable,
    this.diametroMm,
    this.evolucionCambios,
    this.sintomaSangrado,
    this.sintomaPicazon,
    this.sintomaDolor,
    this.sintomaUlceracion,
    this.diagnosticoMedico,
    this.notasMedico,
    this.requiereBiopsia,
  });

  factory Evaluation.fromJson(Map<String, dynamic> json) {
    return Evaluation(
      id: json['id'],
      idLesion: json['id_lesion'],
      idUsuarioRegistro: json['id_usuario_registro'],
      idMedicoValidador: json['id_medico_validador'],
      rutaImagen: json['ruta_imagen'],
      prediccionIa: (json['prediccion_ia'] as num?)?.toDouble(),
      asimetria: json['asimetria'],
      bordesIrregulares: json['bordes_irregulares'],
      colorVariable: json['color_variable'],
      diametroMm: (json['diametro_mm'] as num?)?.toDouble(),
      evolucionCambios: json['evolucion_cambios'],
      sintomaSangrado: json['sintoma_sangrado'],
      sintomaPicazon: json['sintoma_picazon'],
      sintomaDolor: json['sintoma_dolor'],
      sintomaUlceracion: json['sintoma_ulceracion'],
      diagnosticoMedico: json['diagnostico_medico'],
      notasMedico: json['notas_medico'],
      requiereBiopsia: json['requiere_biopsia'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      if (idLesion != null) 'id_lesion': idLesion,
      if (idUsuarioRegistro != null) 'id_usuario_registro': idUsuarioRegistro,
      if (idMedicoValidador != null) 'id_medico_validador': idMedicoValidador,
      'ruta_imagen': rutaImagen,
      if (prediccionIa != null) 'prediccion_ia': prediccionIa,
      if (asimetria != null) 'asimetria': asimetria,
      if (bordesIrregulares != null) 'bordes_irregulares': bordesIrregulares,
      if (colorVariable != null) 'color_variable': colorVariable,
      if (diametroMm != null) 'diametro_mm': diametroMm,
      if (evolucionCambios != null) 'evolucion_cambios': evolucionCambios,
      if (sintomaSangrado != null) 'sintoma_sangrado': sintomaSangrado,
      if (sintomaPicazon != null) 'sintoma_picazon': sintomaPicazon,
      if (sintomaDolor != null) 'sintoma_dolor': sintomaDolor,
      if (sintomaUlceracion != null) 'sintoma_ulceracion': sintomaUlceracion,
      if (diagnosticoMedico != null) 'diagnostico_medico': diagnosticoMedico,
      if (notasMedico != null) 'notas_medico': notasMedico,
      if (requiereBiopsia != null) 'requiere_biopsia': requiereBiopsia,
    };
  }
}
