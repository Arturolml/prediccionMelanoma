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

  bool _avisoSocketMostrado = false;

  void _initSocket() {
    final userId = ApiService().currentUserid;
    if (userId == null) return;

    // El backend autentica el socket con el token de sesión y lo une a la
    // sala de este usuario (ya no se elige la sala con un userId).
    socket = IO.io(ApiService.socketOrigin, <String, dynamic>{
      'path': ApiService.socketPath,
      'transports': ['websocket'],
      'autoConnect': false,
      'auth': {'token': ApiService().token},
    });

    socket!.connect();

    socket!.onConnect((_) {
      print('✅ Socket connected');
      // Solo se avisa si antes hubo una falla de conexión
      if (_avisoSocketMostrado && mounted) {
        _avisoSocketMostrado = false;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Conexión en tiempo real con la Web restablecida.'),
            backgroundColor: Colors.green,
          ),
        );
      }
    });

    socket!.on('error_autenticacion', (data) {
      print('❌ Socket rechazado por el servidor: $data');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'El servidor rechazó la sesión. Cierre sesión y vuelva a entrar.',
          ),
          backgroundColor: Colors.red,
          duration: Duration(seconds: 8),
        ),
      );
    });

    socket!.onConnectError((err) {
      print('❌ Socket connect error: $err');
      // La librería reintenta sola; un solo aviso aunque falle varias veces
      if (!mounted || _avisoSocketMostrado) return;
      _avisoSocketMostrado = true;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Sin conexión en tiempo real con la Web. Reintentando...\n$err',
          ),
          backgroundColor: Colors.orange,
          duration: const Duration(seconds: 8),
        ),
      );
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
      // maxWidth mantiene el base64 bajo el límite de 1 MB de Socket.IO
      final XFile? image = await picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 70,
        maxWidth: 1600,
      );

      if (image != null && mounted) {
        final bytes = await image.readAsBytes();
        final base64String = base64Encode(bytes);

        socket!.emit('foto_capturada', {
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
