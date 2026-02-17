import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/lesion_provider.dart';
import '../models/lesion_model.dart';

class AddLesionScreen extends StatefulWidget {
  const AddLesionScreen({super.key});

  @override
  State<AddLesionScreen> createState() => _AddLesionScreenState();
}

class _AddLesionScreenState extends State<AddLesionScreen> {
  final _formKey = GlobalKey<FormState>();
  final _zonaController = TextEditingController();
  final _notasController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Agregar Lesión')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _zonaController,
                decoration: const InputDecoration(
                  labelText: 'Zona del Cuerpo (ej. Espalda)',
                ),
                validator: (value) => value!.isEmpty ? 'Requerido' : null,
              ),
              TextFormField(
                controller: _notasController,
                decoration: const InputDecoration(labelText: 'Notas'),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () async {
                  if (_formKey.currentState!.validate()) {
                    final lesion = Lesion(
                      idPaciente: 1, // Hardcoded for now
                      zonaCuerpo: _zonaController.text,
                      notasUbicacion: _notasController.text,
                      fechaDeteccion: DateTime.now(),
                    );

                    final success = await Provider.of<LesionProvider>(
                      context,
                      listen: false,
                    ).addLesion(lesion);

                    if (success && context.mounted) {
                      Navigator.pop(context);
                    }
                  }
                },
                child: const Text('Guardar Lesión'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
