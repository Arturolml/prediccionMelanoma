class Lesion {
  final int? id;
  final int? idPaciente;
  final String zonaCuerpo;
  final DateTime? fechaDeteccion;
  final String? notasUbicacion;

  Lesion({
    this.id,
    this.idPaciente,
    required this.zonaCuerpo,
    this.fechaDeteccion,
    this.notasUbicacion,
  });

  factory Lesion.fromJson(Map<String, dynamic> json) {
    return Lesion(
      id: json['id'],
      idPaciente: json['id_paciente'],
      zonaCuerpo: json['zona_cuerpo'],
      fechaDeteccion: json['fecha_deteccion'] != null
          ? DateTime.parse(json['fecha_deteccion'])
          : null,
      notasUbicacion: json['notas_ubicacion'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      if (idPaciente != null) 'id_paciente': idPaciente,
      'zona_cuerpo': zonaCuerpo,
      if (fechaDeteccion != null)
        'fecha_deteccion': fechaDeteccion!.toIso8601String(),
      if (notasUbicacion != null) 'notas_ubicacion': notasUbicacion,
    };
  }
}
