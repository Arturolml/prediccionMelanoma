import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../services/api_service.dart';
import '../providers/auth_provider.dart';

class CreatePatientScreen extends StatefulWidget {
  const CreatePatientScreen({super.key});

  @override
  State<CreatePatientScreen> createState() => _CreatePatientScreenState();
}

class _CreatePatientScreenState extends State<CreatePatientScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nombresController = TextEditingController();
  final _paternoController = TextEditingController();
  final _maternoController = TextEditingController();
  final _curpController = TextEditingController();
  String _selectedSex =
      'M'; // "M" or "F" based on prisma enum usually, need to check types
  DateTime? _birthDate;

  bool _isLoading = false;

  Future<void> _createPatient() async {
    if (!_formKey.currentState!.validate()) return;
    if (_birthDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Seleccione Fecha de Nacimiento')),
      );
      return;
    }

    setState(() => _isLoading = true);

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final url = Uri.parse('${ApiService.baseUrl}/pacientes');

    try {
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${authProvider.token}',
        },
        body: jsonEncode({
          'nombres': _nombresController.text,
          'apellido_paterno': _paternoController.text,
          'apellido_materno': _maternoController.text,
          'curp': _curpController.text,
          'sexo': _selectedSex,
          'fecha_nacimiento': _birthDate!.toIso8601String(),
        }),
      );

      if (response.statusCode == 201) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Paciente creado exitosamente')),
          );
          Navigator.pop(context);
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Failed: ${response.body}')));
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _selectDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
    );
    if (picked != null && picked != _birthDate) {
      setState(() {
        _birthDate = picked;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Crear Paciente (Médico)')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              TextFormField(
                controller: _nombresController,
                decoration: const InputDecoration(
                  labelText: 'Apellido Paterno',
                ),
                validator: (v) => v!.isEmpty ? 'Requerido' : null,
              ),
              TextFormField(
                controller: _paternoController,
                decoration: const InputDecoration(
                  labelText: 'Paternal Surname',
                ),
                validator: (v) => v!.isEmpty ? 'Required' : null,
              ),
              TextFormField(
                controller: _maternoController,
                decoration: const InputDecoration(
                  labelText: 'Maternal Surname',
                ),
                validator: (v) => v!.isEmpty ? 'Required' : null,
              ),
              TextFormField(
                controller: _curpController,
                decoration: const InputDecoration(labelText: 'CURP'),
                validator: (v) => v!.isEmpty ? 'Requerido' : null,
              ),
              DropdownButtonFormField<String>(
                value: _selectedSex,
                items:
                    ['M', 'F'] // Adjust based on DB enum
                        .map(
                          (sex) => DropdownMenuItem(
                            value: sex,
                            child: Text(sex == 'M' ? 'Hombre' : 'Mujer'),
                          ),
                        )
                        .toList(),
                onChanged: (v) => setState(() => _selectedSex = v!),
                decoration: const InputDecoration(labelText: 'Sexo'),
              ),
              ListTile(
                title: Text(
                  _birthDate == null
                      ? 'Seleccionar Fecha de Nacimiento'
                      : 'Fecha de Nacimiento: ${_birthDate.toString().split(' ')[0]}',
                ),
                trailing: const Icon(Icons.calendar_today),
                onTap: () => _selectDate(context),
              ),
              const SizedBox(height: 20),
              _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : ElevatedButton(
                      onPressed: _createPatient,
                      child: const Text('Crear Paciente'),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}
