import 'package:flutter/material.dart';
import 'package:flutter_app_1/constants/alertas.dart';

class AlertasClinicasView extends StatelessWidget {
  final Map<String, dynamic>? paciente;
  final Map<String, dynamic>? evaluacion;

  const AlertasClinicasView({super.key, this.paciente, this.evaluacion});

  @override
  Widget build(BuildContext context) {
    final alertas = alertasClinicas(paciente, evaluacion);
    if (alertas.isEmpty) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.orange.shade300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Datos clínicos a considerar',
            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.orange.shade900),
          ),
          for (final a in alertas) Text('• $a'),
          const Text(
            'La IA no usa estos datos: su resultado no los incluye.',
            style: TextStyle(fontSize: 12, color: Colors.black54),
          ),
        ],
      ),
    );
  }
}
