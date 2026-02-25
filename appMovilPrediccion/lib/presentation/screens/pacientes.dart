import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:flutter_app_1/presentation/screens/crear_paciente.dart';
import 'package:flutter_app_1/presentation/screens/detalle_paciente.dart';

import 'package:flutter_app_1/services/api_service.dart';
import 'package:flutter_app_1/presentation/screens/login.dart';

class PacientesScreen extends StatefulWidget {
  const PacientesScreen({super.key});

  @override
  State<PacientesScreen> createState() => _PacientesScreenState();
}

class _PacientesScreenState extends State<PacientesScreen> {
  List<Map<String, dynamic>> patients = [];
  bool isLoading = true;
  IO.Socket? socket;

  @override
  void initState() {
    super.initState();
    _loadPacientes();
    _initSocket();
  }

  void _initSocket() {
    final userId = ApiService().currentUserid;
    if (userId == null) return;

    socket = IO.io(ApiService.baseUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
    });

    socket!.connect();

    socket!.onConnect((_) {
      print('✅ Socket connected');
      socket!.emit('join_room', {'userId': userId});
    });

    socket!.on('abrir_camara', (_) async {
      print('📸 Solicitud de cámara recibida por WebSocket!');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('La Web solicita una foto. Abriendo cámara...'),
        ),
      );

      final ImagePicker picker = ImagePicker();
      final XFile? image = await picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 70,
      );

      if (image != null && mounted) {
        final bytes = await image.readAsBytes();
        final base64String = base64Encode(bytes);

        socket!.emit('foto_capturada', {
          'userId': userId,
          'imageBase64': 'data:image/jpeg;base64,$base64String',
        });

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Foto enviada correctamente a la Web.'),
            backgroundColor: Colors.green,
          ),
        );
      }
    });
  }

  @override
  void dispose() {
    socket?.dispose();
    super.dispose();
  }

  Future<void> _loadPacientes() async {
    final data = await ApiService().getPacientes();
    setState(() {
      patients = data;
      isLoading = false;
    });
  }

  void _logout() {
    // Clear token logic if implemented in ApiService
    // ApiService().logout();
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (context) => const LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pacientes'),
        actions: [
          IconButton(
            icon: const Icon(Icons.exit_to_app),
            onPressed: _logout,
            tooltip: 'Cerrar Sesión',
          ),
        ],
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : patients.isEmpty
          ? const Center(child: Text('No hay pacientes registrados'))
          : ListView.builder(
              itemCount: patients.length,
              itemBuilder: (context, index) {
                final patient = patients[index];
                final nombreCompleto =
                    '${patient['nombres']} ${patient['apellido_paterno']}'
                    ' ${patient['apellido_materno'] ?? ''}';

                return Card(
                  margin: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  child: ListTile(
                    leading: CircleAvatar(
                      child: Text(
                        patient['nombres'].isNotEmpty
                            ? patient['nombres'][0]
                            : '?',
                      ),
                    ),
                    title: Text(nombreCompleto),
                    subtitle: Text('CURP: ${patient['curp']}'),
                    trailing: const Icon(Icons.arrow_forward_ios),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) =>
                              DetallePacienteScreen(patient: patient),
                        ),
                      ).then((_) => _loadPacientes()); // Reload on return
                    },
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.of(context)
              .push(
                MaterialPageRoute(builder: (context) => const CrearPaciente()),
              )
              .then((_) => _loadPacientes());
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
