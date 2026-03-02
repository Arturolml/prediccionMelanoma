import 'dart:async';
import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_app_1/presentation/screens/pacientes.dart'
    show PacientesScreen;
import 'package:flutter_app_1/services/api_service.dart';

class CrearPaciente extends StatefulWidget {
  const CrearPaciente({super.key});

  @override
  State<CrearPaciente> createState() => _CrearPacienteState();
}

class _CrearPacienteState extends State<CrearPaciente> {
  final _formKey = GlobalKey<FormState>();

  // Controllers - Identity
  final _nombresController = TextEditingController();
  final _apellidoPaternoController = TextEditingController();
  final _apellidoMaternoController = TextEditingController();
  final _curpController = TextEditingController();

  // Controllers - Dermatology
  final _notasAntecedentesController = TextEditingController();

  // State Variables
  DateTime? _fechaNacimiento;
  String? _sexo;
  double _fototipo = 1.0;
  bool _antecedentesFamiliares = false;
  bool _historialCancer = false;
  bool _inmunosupresion = false;

  bool _isOffline = false;
  late StreamSubscription<List<ConnectivityResult>> _connectivitySubscription;

  @override
  void initState() {
    super.initState();
    _checkInitialConnectivity();
    _connectivitySubscription = Connectivity().onConnectivityChanged.listen((
      List<ConnectivityResult> results,
    ) {
      if (mounted) {
        setState(() {
          _isOffline = results.contains(ConnectivityResult.none);
        });
      }
    });
  }

  Future<void> _checkInitialConnectivity() async {
    final results = await Connectivity().checkConnectivity();
    if (mounted) {
      setState(() {
        _isOffline = results.contains(ConnectivityResult.none);
      });
    }
  }

  @override
  void dispose() {
    _connectivitySubscription.cancel();
    _nombresController.dispose();
    _apellidoPaternoController.dispose();
    _apellidoMaternoController.dispose();
    _curpController.dispose();
    _notasAntecedentesController.dispose();
    super.dispose();
  }

  Future<void> _selectDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
    );
    if (picked != null && picked != _fechaNacimiento) {
      setState(() {
        _fechaNacimiento = picked;
      });
    }
  }

  void _submitForm() async {
    if (_formKey.currentState!.validate()) {
      if (_fechaNacimiento == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Por favor seleccione la fecha de nacimiento'),
          ),
        );
        return;
      }

      final patientData = {
        'nombres': _nombresController.text,
        'apellido_paterno': _apellidoPaternoController.text,
        'apellido_materno': _apellidoMaternoController.text,
        'curp': _curpController.text,
        'fecha_nacimiento': _fechaNacimiento!.toIso8601String(),
        'sexo': _sexo,
        'fototipo_fitzpatrick': _fototipo.toInt(), // Send as Int
        'antecedentes_familiares': _antecedentesFamiliares,
        'notas_antecedentes': _antecedentesFamiliares
            ? _notasAntecedentesController.text
            : '',
        'historial_cancer_previo': _historialCancer,
        'inmunosuprimido': _inmunosupresion,
      };

      debugPrint('Patient Data: $patientData');

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Guardando paciente...')));

      // Usar ApiService
      final success = await ApiService().createPaciente(patientData);

      if (!mounted) return;

      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _isOffline
                  ? 'Paciente guardado localmente.'
                  : 'Paciente creado exitosamente',
            ),
          ),
        );
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => const PacientesScreen()),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Error al crear paciente'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Crear Paciente')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_isOffline)
                Container(
                  padding: const EdgeInsets.all(8),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade100,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.orange.shade400),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.wifi_off, color: Colors.orange.shade800),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Sin Wi-Fi. El paciente se guardará localmente.',
                          style: TextStyle(color: Colors.orange.shade900),
                        ),
                      ),
                    ],
                  ),
                ),
              const Text(
                'Datos del paciente',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const Divider(),

              // Nombres
              TextFormField(
                controller: _nombresController,
                decoration: const InputDecoration(labelText: 'Nombres'),
                validator: (value) =>
                    value == null || value.isEmpty ? 'Requerido' : null,
              ),
              const SizedBox(height: 10),

              // Apellidos Row
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _apellidoPaternoController,
                      decoration: const InputDecoration(
                        labelText: 'Apellido Paterno',
                      ),
                      validator: (value) =>
                          value == null || value.isEmpty ? 'Requerido' : null,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextFormField(
                      controller: _apellidoMaternoController,
                      decoration: const InputDecoration(
                        labelText: 'Apellido Materno (Opcional)',
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // CURP
              TextFormField(
                controller: _curpController,
                decoration: const InputDecoration(labelText: 'CURP'),
                maxLength: 18,
                textCapitalization: TextCapitalization.characters,
                validator: (value) {
                  if (value == null || value.isEmpty) return 'Requerido';
                  if (value.length != 18) return 'Debe tener 18 caracteres';
                  return null;
                },
              ),

              // Fecha Nacimiento & Sexo Row
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => _selectDate(context),
                      child: InputDecorator(
                        decoration: const InputDecoration(
                          labelText: 'Fecha de Nacimiento',
                        ),
                        child: Text(
                          _fechaNacimiento == null
                              ? 'Seleccionar'
                              : '${_fechaNacimiento!.day}/${_fechaNacimiento!.month}/${_fechaNacimiento!.year}',
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: _sexo,
                      decoration: const InputDecoration(labelText: 'Sexo'),
                      items: const [
                        DropdownMenuItem(value: 'M', child: Text('Masculino')),
                        DropdownMenuItem(value: 'F', child: Text('Femenino')),
                        DropdownMenuItem(value: 'Otro', child: Text('Otro')),
                      ],
                      onChanged: (v) => setState(() => _sexo = v),
                      validator: (v) => v == null ? 'Requerido' : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              const Text(
                'Información Dermatológica y Antecedentes',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const Divider(),

              // Fototipo Slider
              Text('Fototipo de Fitzpatrick: ${_fototipo.toInt()}'),
              Slider(
                value: _fototipo,
                min: 1,
                max: 6,
                divisions: 5,
                label: _fototipo.toInt().toString(),
                onChanged: (v) => setState(() => _fototipo = v),
              ),

              // Antecedentes Familiares
              SwitchListTile(
                title: const Text(
                  'Antecedentes Familiares de problemas en piel',
                ),
                value: _antecedentesFamiliares,
                onChanged: (v) => setState(() => _antecedentesFamiliares = v),
              ),

              // Notas Antecedentes (Conditional)
              if (_antecedentesFamiliares)
                Padding(
                  padding: const EdgeInsets.only(left: 16.0, bottom: 10.0),
                  child: TextFormField(
                    controller: _notasAntecedentesController,
                    decoration: const InputDecoration(
                      labelText: 'Notas de Antecedentes',
                      border: OutlineInputBorder(),
                    ),
                    maxLines: 3,
                    validator: (value) {
                      if (_antecedentesFamiliares &&
                          (value == null || value.isEmpty)) {
                        return 'Por favor detalle los antecedentes';
                      }
                      return null;
                    },
                  ),
                ),

              // Historial Cancer
              SwitchListTile(
                title: const Text('Historial de Cáncer'),
                value: _historialCancer,
                onChanged: (v) => setState(() => _historialCancer = v),
              ),

              // Inmunosupresion
              SwitchListTile(
                title: const Text('Inmunosupresión'),
                value: _inmunosupresion,
                onChanged: (v) => setState(() => _inmunosupresion = v),
              ),
              const SizedBox(height: 24),

              // Submit
              ElevatedButton(
                onPressed: _submitForm,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: const Text('Registrar Paciente'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
