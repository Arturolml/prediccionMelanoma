import 'package:flutter/material.dart';
import 'package:flutter_app_1/presentation/screens/crear_evaluacion.dart';
import 'package:flutter_app_1/presentation/screens/detalle_evaluacion.dart';
import 'package:flutter_app_1/services/api_service.dart';

class DetallePacienteScreen extends StatefulWidget {
  final Map<String, dynamic> patient;

  const DetallePacienteScreen({super.key, required this.patient});

  @override
  State<DetallePacienteScreen> createState() => _DetallePacienteScreenState();
}

class _DetallePacienteScreenState extends State<DetallePacienteScreen> {
  List<Map<String, dynamic>> evaluaciones = [];
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadEvaluaciones();
  }

  Future<void> _loadEvaluaciones() async {
    final patientId = widget.patient['id_paciente'] is int
        ? widget.patient['id_paciente'] as int
        : int.tryParse(widget.patient['id_paciente'].toString()) ?? 0;

    if (patientId > 0) {
      final data = await ApiService().getEvaluaciones(patientId);
      if (mounted) {
        setState(() {
          evaluaciones = data;
          isLoading = false;
        });
      }
    } else {
      if (mounted) {
        setState(() {
          isLoading = false;
        });
      }
    }
  }

  void _addEvaluacion(Map<String, dynamic> newEvaluacion) {
    _loadEvaluaciones(); // Refresh from API to get full data
  }

  @override
  Widget build(BuildContext context) {
    final patient = widget.patient;
    final nombreCompleto =
        '${patient['nombres']} ${patient['apellido_paterno']}'
        ' ${patient['apellido_materno'] ?? ''}';

    return Scaffold(
      appBar: AppBar(title: Text(patient['nombres'])),
      body: Column(
        children: [
          // Header with Patient Info
          Expanded(
            flex: 2,
            child: Container(
              padding: const EdgeInsets.all(16.0),
              color: Colors.blue.shade50,
              width: double.infinity,
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      nombreCompleto.trim(),
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text('CURP: ${patient['curp']}'),
                    Text('Fecha Nac: ${patient['fecha_nacimiento']}'),
                    Text('Sexo: ${patient['sexo']}'),
                    Text(
                      'Fototipo: ${patient['fototipo_fitzpatrick'] ?? 'N/A'}',
                    ),
                  ],
                ),
              ),
            ),
          ),

          const Divider(height: 1),

          // Evaluations List
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                const Icon(Icons.history, color: Colors.blue),
                const SizedBox(width: 8),
                Text(
                  'Evaluaciones (${evaluaciones.length})',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),

          Expanded(
            flex: 3,
            child: evaluaciones.isEmpty
                ? const Center(child: Text('No hay evaluaciones registradas'))
                : ListView.builder(
                    itemCount: evaluaciones.length,
                    itemBuilder: (context, index) {
                      final evaluacion = evaluaciones[index];
                      // Handle both String and Map logic for mock/real data
                      // Assuming Map for now based on previous `pacientes.dart`
                      final fecha =
                          evaluacion['fecha'] ??
                          evaluacion['fecha_evaluacion']?.toString().split(
                            'T',
                          )[0] ??
                          'Fecha desconocida';
                      final diagnostico =
                          evaluacion['diagnostico'] ??
                          evaluacion['diagnostico_medico'] ??
                          'Sin diagnóstico';
                      final tratamiento = evaluacion['tratamiento'] ?? '';
                      final notas =
                          evaluacion['observaciones'] ??
                          evaluacion['notas_medico'] ??
                          'Ninguna';

                      return Card(
                        margin: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        child: Column(
                          children: [
                            ExpansionTile(
                              leading: const Icon(Icons.assignment),
                              title: Text(fecha),
                              subtitle: Text(diagnostico),
                              children: [
                                Padding(
                                  padding: const EdgeInsets.all(16.0),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      if (tratamiento.isNotEmpty) ...[
                                        const Text(
                                          'Tratamiento:',
                                          style: TextStyle(
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                        Text(tratamiento),
                                        const SizedBox(height: 8),
                                      ],
                                      const Text(
                                        'Notas / Observaciones:',
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      Text(notas),
                                      const SizedBox(height: 16),
                                      Center(
                                        child: ElevatedButton.icon(
                                          icon: const Icon(Icons.visibility),
                                          label: const Text(
                                            'Ver Detalle Completo y Foto',
                                          ),
                                          onPressed: () {
                                            Navigator.push(
                                              context,
                                              MaterialPageRoute(
                                                builder: (context) =>
                                                    DetalleEvaluacionScreen(
                                                      evaluacion: evaluacion,
                                                    ),
                                              ),
                                            );
                                          },
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final result = await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => CrearEvaluacionScreen(
                pacienteId: widget.patient['id_paciente'] is int
                    ? widget.patient['id_paciente']
                    : int.tryParse(widget.patient['id_paciente'].toString()),
              ),
            ),
          );

          if (result != null && result is Map<String, dynamic>) {
            if (!context.mounted) return;
            _addEvaluacion(result);
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Evaluación agregada')),
            );
          }
        },
        child: const Icon(Icons.add_comment),
      ),
    );
  }
}
