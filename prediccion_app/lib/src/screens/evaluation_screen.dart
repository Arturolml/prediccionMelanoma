import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../providers/lesion_provider.dart';
import '../models/lesion_model.dart';
import '../models/evaluation_model.dart';
import '../services/api_service.dart';

class EvaluationScreen extends StatefulWidget {
  final Lesion lesion;

  const EvaluationScreen({super.key, required this.lesion});

  @override
  State<EvaluationScreen> createState() => _EvaluationScreenState();
}

class _EvaluationScreenState extends State<EvaluationScreen> {
  File? _image;
  final _picker = ImagePicker();
  bool _isUploading = false;
  String? _uploadedImageUrl;

  // Symptoms
  bool _asimetria = false;
  bool _bordesIrregulares = false;
  bool _colorVariable = false;
  bool _evolucionCambios = false;

  double _diametro = 0.0;

  Future<void> _pickImage(ImageSource source) async {
    final pickedFile = await _picker.pickImage(source: source);
    if (pickedFile != null) {
      setState(() {
        _image = File(pickedFile.path);
      });
      _uploadImage();
    }
  }

  Future<void> _uploadImage() async {
    if (_image == null) return;
    setState(() => _isUploading = true);
    try {
      final url = await ApiService().uploadImage(_image!);
      setState(() {
        _uploadedImageUrl = url;
        _isUploading = false;
      });
    } catch (e) {
      setState(() => _isUploading = false);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Evaluar: ${widget.lesion.zonaCuerpo}')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            // Image Section
            GestureDetector(
              onTap: () {
                showModalBottomSheet(
                  context: context,
                  builder: (_) => Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ListTile(
                        leading: const Icon(Icons.camera),
                        title: const Text('Cámara'),
                        onTap: () => _pickImage(ImageSource.camera),
                      ),
                      ListTile(
                        leading: const Icon(Icons.photo),
                        title: const Text('Galería'),
                        onTap: () => _pickImage(ImageSource.gallery),
                      ),
                    ],
                  ),
                );
              },
              child: Container(
                height: 200,
                width: double.infinity,
                color: Colors.grey[200],
                child: _image != null
                    ? Image.file(_image!, fit: BoxFit.cover)
                    : const Icon(Icons.add_a_photo, size: 50),
              ),
            ),
            if (_isUploading) const LinearProgressIndicator(),
            const SizedBox(height: 20),

            // Checklist
            CheckboxListTile(
              title: const Text('Asimetría'),
              value: _asimetria,
              onChanged: (v) => setState(() => _asimetria = v!),
            ),
            CheckboxListTile(
              title: const Text('Bordes Irregulares'),
              value: _bordesIrregulares,
              onChanged: (v) => setState(() => _bordesIrregulares = v!),
            ),
            CheckboxListTile(
              title: const Text('Color Variable'),
              value: _colorVariable,
              onChanged: (v) => setState(() => _colorVariable = v!),
            ),
            CheckboxListTile(
              title: const Text('Evolución/Cambios'),
              value: _evolucionCambios,
              onChanged: (v) => setState(() => _evolucionCambios = v!),
            ),

            TextField(
              decoration: const InputDecoration(labelText: 'Diámetro (mm)'),
              keyboardType: TextInputType.number,
              onChanged: (v) => _diametro = double.tryParse(v) ?? 0.0,
            ),

            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _uploadedImageUrl == null
                  ? null
                  : () async {
                      final evaluation = Evaluation(
                        idLesion: widget.lesion.id,
                        idUsuarioRegistro: 1, // Hardcoded
                        rutaImagen: _uploadedImageUrl!,
                        asimetria: _asimetria,
                        bordesIrregulares: _bordesIrregulares,
                        colorVariable: _colorVariable,
                        evolucionCambios: _evolucionCambios,
                        diametroMm: _diametro,
                      );

                      // Note: Evaluation model I created earlier didn't include fechaEvaluacion explicitly but let's check.
                      // Re-checking Evaluation model... it matches DTO. DTO doesn't req date, backend probably sets it.

                      final result = await Provider.of<LesionProvider>(
                        context,
                        listen: false,
                      ).evaluateLesion(evaluation);
                      if (result != null && mounted) {
                        showDialog(
                          context: context,
                          builder: (_) => AlertDialog(
                            title: const Text('Resultado'),
                            content: Text(
                              'Predicción IA: ${result.prediccionIa ?? "Pendiente"}\nDiagnóstico: ${result.diagnosticoMedico ?? "Pendiente"}',
                            ),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(context),
                                child: const Text('OK'),
                              ),
                            ],
                          ),
                        );
                      }
                    },
              child: const Text('Enviar para Análisis'),
            ),
          ],
        ),
      ),
    );
  }
}
