import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'package:flutter_app_1/services/api_service.dart';

class CrearEvaluacionScreen extends StatefulWidget {
  final int? pacienteId; // Optional for now, to support folder structure

  const CrearEvaluacionScreen({super.key, this.pacienteId});

  @override
  State<CrearEvaluacionScreen> createState() => _CrearEvaluacionScreenState();
}

class _CrearEvaluacionScreenState extends State<CrearEvaluacionScreen> {
  final _formKey = GlobalKey<FormState>();

  // Controllers
  // _rutaImagenController is now managed internally by _storedImage
  final _prediccionIaController = TextEditingController();
  final _diametroController = TextEditingController();
  // final _diagnosticoMedicoController = TextEditingController(); // Removed in favor of Dropdown
  final _notasMedicoController = TextEditingController();
  final _zonaCuerpoController = TextEditingController();
  final _notasUbicacionController = TextEditingController();

  // State Variables
  final DateTime _fecha = DateTime.now();
  File? _storedImage;
  final ImagePicker _picker = ImagePicker();

  String? _diagnosticoMedico; // Dropdown value

  // ABCDE Rules
  bool _asimetria = false;
  bool _bordesIrregulares = false;
  bool _colorVariable = false;
  bool _evolucionCambios = false;

  // Symptoms
  bool _sintomaSangrado = false;
  bool _sintomaPicazon = false;
  bool _sintomaDolor = false;
  bool _sintomaUlceracion = false;

  // Medical
  bool _requiereBiopsia = false;

  @override
  void dispose() {
    _prediccionIaController.dispose();
    _diametroController.dispose();
    // _diagnosticoMedicoController.dispose();
    _notasMedicoController.dispose();
    _zonaCuerpoController.dispose();
    _notasUbicacionController.dispose();
    super.dispose();
  }

  Future<void> _takePicture() async {
    final XFile? image = await _picker.pickImage(
      source: ImageSource.camera,
      maxWidth: 600, // Optimize size
    );

    if (image == null) return;

    setState(() {
      _storedImage = File(image.path);
    });
  }

  void _submit() async {
    if (_formKey.currentState!.validate()) {
      if (_storedImage == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Por favor tome una foto de la lesión')),
        );
        return;
      }

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Procesando evaluación...')));

      // 1. Crear Lesión (Asumiendo nueva lesión por evaluación para este flujo simplificado)
      // En un flujo real, seleccionaríamos una lesión existente o crearíamos una nueva explícitamente.
      final pacienteId =
          widget.pacienteId ??
          1; // Fallback to 1 if null (debiera venir de argumento)

      final lesionData = {
        'id_paciente': pacienteId,
        'zona_cuerpo': _zonaCuerpoController.text,
        'fecha_deteccion': _fecha.toIso8601String(),
        'notas_ubicacion': _notasUbicacionController.text,
      };

      final api = ApiService();

      final lesionId = await api.createLesion(lesionData);

      if (lesionId == null) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error al crear la lesión asociada')),
        );
        return;
      }

      final newEvaluacion = {
        'id_lesion': lesionId,
        'fecha_evaluacion': _fecha.toIso8601String(),
        'id_usuario_registro': 1, // Idealmente del token/usuario logueado
        'id_medico_validador': 1, // Idealmente del token/usuario logueado
        // 'ruta_imagen': savedPath, // Backend lo maneja con el archivo
        'prediccion_ia': double.tryParse(_prediccionIaController.text) ?? 0.0,
        'asimetria': _asimetria,
        'bordes_irregulares': _bordesIrregulares,
        'color_variable': _colorVariable,
        'diametro_mm': double.tryParse(_diametroController.text) ?? 0.0,
        'evolucion_cambios': _evolucionCambios,
        'sintoma_sangrado': _sintomaSangrado,
        'sintoma_picazon': _sintomaPicazon,
        'sintoma_dolor': _sintomaDolor,
        'sintoma_ulceracion': _sintomaUlceracion,
        'diagnostico_medico': _diagnosticoMedico,
        'notas_medico': _notasMedicoController.text,
        'requiere_biopsia': _requiereBiopsia,
      };

      final success = await api.createEvaluacion(newEvaluacion, _storedImage!);

      if (!mounted) return;

      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Evaluación guardada exitosamente')),
        );
        Navigator.pop(context, newEvaluacion);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error al guardar evaluación')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nueva Evaluación Médica')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header Info
              const Text(
                'Información General',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
              const Divider(),
              ListTile(
                title: const Text('Fecha'),
                subtitle: Text('${_fecha.day}/${_fecha.month}/${_fecha.year}'),
                trailing: const Icon(Icons.calendar_today),
              ),

              const SizedBox(height: 10),
              // Image Preview & Camera Button
              Container(
                height: 200,
                width: double.infinity,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: _storedImage != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.file(
                          _storedImage!,
                          fit: BoxFit.cover,
                          width: double.infinity,
                        ),
                      )
                    : const Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.image_not_supported,
                            size: 50,
                            color: Colors.grey,
                          ),
                          Text(
                            'Sin imagen',
                            style: TextStyle(color: Colors.grey),
                          ),
                        ],
                      ),
              ),
              const SizedBox(height: 10),
              ElevatedButton.icon(
                onPressed: _takePicture,
                icon: const Icon(Icons.camera_alt),
                label: const Text('Tomar Foto'),
              ),

              const SizedBox(height: 16),

              // 2. Información Lesión
              const SizedBox(height: 10),
              const Text(
                'Información de la Lesión',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
              const Divider(),

              TextFormField(
                controller: _zonaCuerpoController,
                decoration: const InputDecoration(
                  labelText: 'Zona del Cuerpo (Ej. Espalda, Brazo)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.accessibility_new),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Ingrese la zona del cuerpo';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _notasUbicacionController,
                decoration: const InputDecoration(
                  labelText: 'Notas de Ubicación (Opcional)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.note),
                ),
                maxLines: 2,
              ),

              const SizedBox(height: 16),

              // Regla ABCDE
              const SizedBox(height: 10),
              const Text(
                'Regla ABCDE (Dermatoscopia)',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
              const Divider(),

              SwitchListTile(
                title: const Text('A - Asimetría'),
                value: _asimetria,
                onChanged: (v) => setState(() => _asimetria = v),
              ),
              SwitchListTile(
                title: const Text('B - Bordes Irregulares'),
                value: _bordesIrregulares,
                onChanged: (v) => setState(() => _bordesIrregulares = v),
              ),
              SwitchListTile(
                title: const Text('C - Color Variable'),
                value: _colorVariable,
                onChanged: (v) => setState(() => _colorVariable = v),
              ),
              TextFormField(
                controller: _diametroController,
                decoration: const InputDecoration(
                  labelText: 'D - Diámetro (mm)',
                  border: OutlineInputBorder(),
                ),
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
              ),
              SwitchListTile(
                title: const Text('E - Evolución/Cambios'),
                value: _evolucionCambios,
                onChanged: (v) => setState(() => _evolucionCambios = v),
              ),

              // Síntomas
              const SizedBox(height: 10),
              const Text(
                'Síntomas Asociados',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
              const Divider(),

              CheckboxListTile(
                title: const Text('Sangrado'),
                value: _sintomaSangrado,
                onChanged: (v) => setState(() => _sintomaSangrado = v!),
              ),
              CheckboxListTile(
                title: const Text('Picazón'),
                value: _sintomaPicazon,
                onChanged: (v) => setState(() => _sintomaPicazon = v!),
              ),
              CheckboxListTile(
                title: const Text('Dolor'),
                value: _sintomaDolor,
                onChanged: (v) => setState(() => _sintomaDolor = v!),
              ),
              CheckboxListTile(
                title: const Text('Ulceración'),
                value: _sintomaUlceracion,
                onChanged: (v) => setState(() => _sintomaUlceracion = v!),
              ),

              // Evaluación Médica
              const SizedBox(height: 10),
              const Text(
                'Evaluación Médica',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
              const Divider(),

              TextFormField(
                controller: _prediccionIaController,
                decoration: const InputDecoration(
                  labelText: 'Predicción IA (%) (Opcional)',
                  border: OutlineInputBorder(),
                ),
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
              ),
              const SizedBox(height: 16),

              DropdownButtonFormField<String>(
                value: _diagnosticoMedico,
                decoration: const InputDecoration(
                  labelText: 'Diagnóstico Médico',
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'Benigno', child: Text('Benigno')),
                  DropdownMenuItem(
                    value: 'Sospechoso',
                    child: Text('Sospechoso'),
                  ),
                  DropdownMenuItem(
                    value: 'Maligno_Melanoma',
                    child: Text('Maligno / Melanoma'),
                  ),
                  DropdownMenuItem(
                    value: 'Indeterminado',
                    child: Text('Indeterminado'),
                  ),
                ],
                onChanged: (value) {
                  setState(() {
                    _diagnosticoMedico = value;
                  });
                },
                validator: (v) => v == null ? 'Requerido' : null,
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _notasMedicoController,
                decoration: const InputDecoration(
                  labelText: 'Notas del Médico',
                  border: OutlineInputBorder(),
                ),
                maxLines: 3,
              ),
              const SizedBox(height: 10),

              SwitchListTile(
                title: const Text('Requiere Biopsia'),
                secondary: const Icon(Icons.local_hospital, color: Colors.red),
                value: _requiereBiopsia,
                onChanged: (v) => setState(() => _requiereBiopsia = v),
              ),

              const SizedBox(height: 30),
              ElevatedButton(
                onPressed: _submit,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  textStyle: const TextStyle(fontSize: 18),
                ),
                child: const Text('Guardar Evaluación Completa'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
