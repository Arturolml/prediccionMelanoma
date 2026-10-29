import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_app_1/constants/sitios.dart';
import 'package:flutter_app_1/services/api_service.dart';

String _pct(dynamic p) => '${(100 * (p as num)).toStringAsFixed(1)}%';

const Map<String, String> _nombreColor = {
  'negro': 'negro',
  'marron_oscuro': 'marrón oscuro',
  'marron_claro': 'marrón claro',
  'rojo': 'rojo',
  'azul_gris': 'azul-gris',
  'blanco': 'blanco',
};

/// Color y texto de la decisión de la IA (null si no hay decisión de la Fase 14).
({Color color, String texto})? estiloDecision(String? decision) {
  switch (decision) {
    case 'sospecha':
      return (color: Colors.red.shade700, texto: 'Sospecha de malignidad');
    case 'derivar':
      return (color: Colors.red.shade700, texto: 'Derivar');
    case 'sin_sospecha':
      return (color: Colors.green.shade700, texto: 'Sin sospecha');
  }
  return null;
}

/// Resultado de la IA (API v2): decisión, las dos opiniones, mapas, aporte de
/// los datos del paciente y ABCDE automático.
///
/// - Análisis en vivo: [resultado] trae `imagenes` (PNG en base64).
/// - Evaluación guardada: [resultado] es `resultado_ia` (sin imágenes) y los
///   mapas se piden al backend con [idEvaluacion] y el token de sesión.
class ResultadoIAView extends StatelessWidget {
  final Map<String, dynamic> resultado;
  final dynamic idEvaluacion;

  const ResultadoIAView({super.key, required this.resultado, this.idEvaluacion});

  @override
  Widget build(BuildContext context) {
    final fusion = Map<String, dynamic>.from(resultado['fusion'] ?? {});
    final qresnet = Map<String, dynamic>.from(resultado['qresnet'] ?? {});
    if (fusion.isEmpty || qresnet.isEmpty) return const SizedBox.shrink();
    final decision = estiloDecision(resultado['decision']);
    final imagenes = resultado['imagenes'] as Map<String, dynamic>?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (decision != null)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: decision.color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              resultado['mensaje']?.toString() ?? decision.texto,
              style: TextStyle(color: decision.color, fontWeight: FontWeight.bold),
            ),
          ),
        if (resultado['revisar_caso'] == true)
          Container(
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.orange.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.orange.shade300),
            ),
            child: Text(
              'Los dos modelos no coinciden. En estos casos la IA acierta mucho menos: revise el caso con especial cuidado.',
              style: TextStyle(color: Colors.orange.shade900),
            ),
          ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: _opinion('Fusión', 'imagen + datos del paciente', fusion)),
            const SizedBox(width: 8),
            Expanded(child: _opinion('QResNet', 'solo imagen', qresnet)),
          ],
        ),
        if (imagenes != null || idEvaluacion != null) ...[
          const SizedBox(height: 12),
          const Text('Dónde miró cada modelo', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(child: _mapa('Fusión', imagenes?['mapa_fusion_png'], 'fusion')),
              const SizedBox(width: 6),
              Expanded(child: _mapa('QResNet', imagenes?['mapa_qresnet_png'], 'qresnet')),
              const SizedBox(width: 6),
              Expanded(child: _mapa('Lesión', imagenes?['contorno_lesion_png'], 'contorno')),
            ],
          ),
        ],
        const SizedBox(height: 12),
        _aporteMetadatos(fusion, Map<String, dynamic>.from(resultado['metadatos_usados'] ?? {})),
        const SizedBox(height: 12),
        _abcde(resultado['abcde'] as Map<String, dynamic>?),
        const SizedBox(height: 8),
        Text(
          resultado['advertencia_uso_clinico']?.toString() ??
              'Herramienta de apoyo a la decisión; no sustituye la evaluación dermatológica.',
          style: const TextStyle(fontSize: 12, color: Colors.black54),
        ),
      ],
    );
  }

  Widget _opinion(String titulo, String subtitulo, Map<String, dynamic> d) {
    final sospecha = d['sospecha'] == true;
    final color = sospecha ? Colors.red.shade700 : Colors.green.shade700;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        border: Border(left: BorderSide(color: color, width: 4)),
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(titulo, style: const TextStyle(fontWeight: FontWeight.bold)),
          Text(subtitulo, style: const TextStyle(fontSize: 11, color: Colors.black54)),
          const SizedBox(height: 4),
          Text(_pct(d['prob_maligno']), style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color)),
          Text(
            'umbral ${_pct(d['umbral'])} · ${sospecha ? 'marca sospecha' : 'no marca sospecha'}',
            style: const TextStyle(fontSize: 11, color: Colors.black54),
          ),
        ],
      ),
    );
  }

  Widget _mapa(String titulo, dynamic base64Png, String tipo) {
    final Widget imagen = base64Png is String
        ? Image.memory(base64Decode(base64Png), fit: BoxFit.cover)
        : Image.network(
            '${ApiService.baseUrl}/evaluaciones/$idEvaluacion/mapa/$tipo',
            headers: ApiService().imagenHeaders,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) => const Icon(Icons.image_not_supported, color: Colors.grey),
          );
    return Column(
      children: [
        AspectRatio(aspectRatio: 1, child: ClipRRect(borderRadius: BorderRadius.circular(6), child: imagen)),
        Text(titulo, style: const TextStyle(fontSize: 11, color: Colors.black54)),
      ],
    );
  }

  Widget _aporteMetadatos(Map<String, dynamic> fusion, Map<String, dynamic> metadatos) {
    final aportes = Map<String, dynamic>.from(fusion['aporte_metadatos'] ?? {});
    final sexo = {'male': 'masculino', 'female': 'femenino'}[metadatos['sexo']] ?? 'sin dato';
    final filas = [
      ('edad', 'Edad: ${metadatos['edad'] ?? 'sin dato'}'),
      ('sexo', 'Sexo: $sexo'),
      ('sitio', 'Sitio: ${etiquetaSitio(metadatos['sitio'])}'),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Qué aportan los datos del paciente (Fusión)', style: TextStyle(fontWeight: FontWeight.bold)),
        if (fusion['prob_sin_metadatos'] != null)
          Text(
            'Con la imagen y un paciente cualquiera: ${_pct(fusion['prob_sin_metadatos'])} → con este paciente: ${_pct(fusion['prob_maligno'])}',
            style: const TextStyle(fontSize: 12, color: Colors.black54),
          ),
        for (final (clave, etiqueta) in filas)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Row(
              children: [
                Expanded(child: Text(etiqueta, style: const TextStyle(fontSize: 13))),
                Text(
                  '${((aportes[clave] ?? 0) as num) >= 0 ? '+' : '−'}${(100 * ((aportes[clave] ?? 0) as num).abs()).toStringAsFixed(1)} pts',
                  style: TextStyle(
                    fontSize: 13,
                    color: ((aportes[clave] ?? 0) as num) >= 0 ? Colors.red.shade700 : Colors.blue.shade700,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _abcde(Map<String, dynamic>? a) {
    if (a == null) return const SizedBox.shrink();
    if (a['error'] != null) {
      return Text('ABCDE automático: ${a['error']}', style: const TextStyle(color: Colors.black54));
    }
    String si(dynamic b) => b == true ? 'Sí' : 'No';
    final colores = ((a['colores'] as List?) ?? []).map((c) => _nombreColor[c] ?? c.toString()).join(', ');
    final e = a['evolucion'] as Map<String, dynamic>?;
    final filas = <(String, String)>[
      ('A · Asimetría', si(a['asimetria'])),
      ('B · Borde irregular', si(a['bordes_irregulares'])),
      ('C · Color', '${a['n_colores']} de 6${colores.isNotEmpty ? ' ($colores)' : ''}'),
      (
        'D · Diámetro',
        a['diametro_mm'] != null ? '${(a['diametro_mm'] as num).toStringAsFixed(1)} mm' : 'sin escala en la foto',
      ),
      (
        'E · Evolución',
        e == null
            ? 'sin evaluación anterior de esta lesión'
            : e['error'] != null
            ? e['error'].toString()
            : 'diámetro ${(e['cambio_diametro_pct'] as num) >= 0 ? '+' : ''}${e['cambio_diametro_pct']}%',
      ),
    ];
    final advertencias = ((a['advertencias'] as List?) ?? [])
        .map((x) => x.toString())
        .where((x) => !x.startsWith('sin escala'));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Criterios ABCDE (medición automática)', style: TextStyle(fontWeight: FontWeight.bold)),
        for (final (k, v) in filas)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(width: 130, child: Text(k, style: const TextStyle(fontSize: 13, color: Colors.black54))),
                Expanded(child: Text(v, style: const TextStyle(fontSize: 13))),
              ],
            ),
          ),
        for (final w in advertencias)
          Text('⚠ $w', style: TextStyle(fontSize: 12, color: Colors.orange.shade900)),
      ],
    );
  }
}
