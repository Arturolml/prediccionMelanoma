import 'package:flutter/material.dart';
import 'package:flutter_app_1/services/api_service.dart';

class DetalleEvaluacionScreen extends StatelessWidget {
  final Map<String, dynamic> evaluacion;

  const DetalleEvaluacionScreen({super.key, required this.evaluacion});

  @override
  Widget build(BuildContext context) {
    // Construct full image URL
    final String? rutaImagen = evaluacion['ruta_imagen'];
    final String imageUrl =
        rutaImagen != null && evaluacion['id_evaluacion'] != null
        ? ApiService.urlImagenEvaluacion(evaluacion['id_evaluacion'])
        : '';

    return Scaffold(
      appBar: AppBar(title: const Text('Detalle de Evaluación')),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (imageUrl.isNotEmpty)
              InteractiveViewer(
                child: Image.network(
                  imageUrl,
                  headers: ApiService().imagenHeaders,
                  height: 300,
                  fit: BoxFit.contain,
                  loadingBuilder: (context, child, loadingProgress) {
                    if (loadingProgress == null) return child;
                    return Container(
                      height: 300,
                      color: Colors.grey.shade200,
                      child: Center(
                        child: CircularProgressIndicator(
                          value: loadingProgress.expectedTotalBytes != null
                              ? loadingProgress.cumulativeBytesLoaded /
                                    loadingProgress.expectedTotalBytes!
                              : null,
                        ),
                      ),
                    );
                  },
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      height: 300,
                      color: Colors.grey.shade200,
                      child: const Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.broken_image,
                            size: 50,
                            color: Colors.grey,
                          ),
                          Text('Error al cargar imagen'),
                        ],
                      ),
                    );
                  },
                ),
              )
            else
              Container(
                height: 200,
                color: Colors.grey.shade200,
                child: const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.image_not_supported,
                        size: 50,
                        color: Colors.grey,
                      ),
                      Text('Sin imagen adjunta'),
                    ],
                  ),
                ),
              ),

            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildSectionTitle('Diagnóstico'),
                  Card(
                    color: _getDiagnosticColor(
                      evaluacion['diagnostico_medico'] ?? '',
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.medical_services,
                            color: Colors.white,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              evaluacion['diagnostico_medico'] ??
                                  'Sin diagnóstico',
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  _buildSectionTitle('Información General'),
                  _buildInfoRow(
                    'Fecha:',
                    _formatDate(evaluacion['fecha_evaluacion']),
                  ),
                  _buildInfoRow(
                    'Predicción IA:',
                    '${evaluacion['prediccion_ia'] ?? 0}%',
                  ),
                  _buildInfoRow(
                    'Biopsia Requerida:',
                    evaluacion['requiere_biopsia'] == true ? 'SÍ' : 'NO',
                    isHighlight: evaluacion['requiere_biopsia'] == true,
                  ),

                  const SizedBox(height: 16),
                  _buildSectionTitle('Regla ABCDE'),
                  _buildBooleanRow('Asimetría:', evaluacion['asimetria']),
                  _buildBooleanRow(
                    'Bordes Irregulares:',
                    evaluacion['bordes_irregulares'],
                  ),
                  _buildBooleanRow(
                    'Color Variable:',
                    evaluacion['color_variable'],
                  ),
                  _buildInfoRow(
                    'Diámetro:',
                    '${evaluacion['diametro_mm'] ?? 0} mm',
                  ),
                  _buildBooleanRow(
                    'Evolución/Cambios:',
                    evaluacion['evolucion_cambios'],
                  ),

                  const SizedBox(height: 16),
                  _buildSectionTitle('Síntomas'),
                  _buildBooleanRow('Sangrado:', evaluacion['sintoma_sangrado']),
                  _buildBooleanRow('Picazón:', evaluacion['sintoma_picazon']),
                  _buildBooleanRow('Dolor:', evaluacion['sintoma_dolor']),
                  _buildBooleanRow(
                    'Ulceración:',
                    evaluacion['sintoma_ulceracion'],
                  ),

                  const SizedBox(height: 16),
                  _buildSectionTitle('Notas del Médico'),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.grey.shade300),
                    ),
                    child: Text(
                      evaluacion['notas_medico'] ?? 'Sin notas adicionales.',
                      style: const TextStyle(fontSize: 16),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const Divider(),
        const SizedBox(height: 8),
      ],
    );
  }

  Widget _buildInfoRow(String label, String value, {bool isHighlight = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                color: isHighlight ? Colors.red : Colors.black87,
                fontWeight: isHighlight ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBooleanRow(String label, dynamic value) {
    final bool isTrue = value == true;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 140,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Icon(
            isTrue ? Icons.check_circle : Icons.cancel,
            color: isTrue ? Colors.red : Colors.green,
            size: 20,
          ),
          const SizedBox(width: 8),
          Text(isTrue ? 'Presente' : 'Ausente'),
        ],
      ),
    );
  }

  Color _getDiagnosticColor(String diagnostico) {
    switch (diagnostico.toLowerCase()) {
      case 'benigno':
        return Colors.green;
      case 'sospechoso':
        return Colors.orange;
      case 'maligno_melanoma':
      case 'maligno / melanoma':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  String _formatDate(dynamic dateStr) {
    if (dateStr == null) return 'Desconocida';
    try {
      final date = DateTime.parse(dateStr.toString());
      return '${date.day}/${date.month}/${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
    } catch (e) {
      return dateStr.toString();
    }
  }
}
