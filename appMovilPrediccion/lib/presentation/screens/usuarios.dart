import 'package:flutter/material.dart';
import 'package:flutter_app_1/presentation/screens/create_usuario.dart';

import 'package:flutter_app_1/services/api_service.dart';
import 'package:flutter_app_1/presentation/screens/login.dart';

class UsuariosScreen extends StatefulWidget {
  const UsuariosScreen({super.key});

  @override
  State<UsuariosScreen> createState() => _UsuariosScreenState();
}

class _UsuariosScreenState extends State<UsuariosScreen> {
  List<Map<String, dynamic>> _users = [];
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadUsuarios();
  }

  Future<void> _loadUsuarios() async {
    final data = await ApiService().getUsuarios();
    setState(() {
      _users = data;
      isLoading = false;
    });
  }

  void _logout() {
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (context) => const LoginScreen()),
      (route) => false,
    );
  }

  Future<void> _toggleStatus(int id, bool currentStatus) async {
    final success = await ApiService().toggleUsuarioStatus(id, !currentStatus);
    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            !currentStatus ? 'Usuario activado' : 'Usuario desactivado',
          ),
        ),
      );
      _loadUsuarios();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Error al actualizar estado')),
      );
    }
  }

  void _showChangePasswordDialog(int id) {
    final passwordController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Cambiar Contraseña'),
          content: TextField(
            controller: passwordController,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Nueva Contraseña'),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (passwordController.text.isNotEmpty) {
                  Navigator.pop(context);
                  final success = await ApiService().updateUsuario(id, {
                    'password': passwordController.text,
                  });
                  if (mounted) {
                    if (success) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Contraseña actualizada correctamente'),
                        ),
                      );
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Error al actualizar contraseña'),
                        ),
                      );
                    }
                  }
                }
              },
              child: const Text('Guardar'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Gestión de Usuarios'),
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
          : _users.isEmpty
          ? const Center(child: Text('No hay usuarios registrados'))
          : ListView.separated(
              itemCount: _users.length,
              separatorBuilder: (context, index) => const Divider(),
              itemBuilder: (context, index) {
                final user = _users[index];
                final id = user['id_usuario'];
                final rol = user['rol'] ?? 'desconocido';
                final activo = user['activo'] == true;
                final nombre = user['nombre_completo'] ?? 'Sin nombre';
                final email = user['email'];

                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: activo ? Colors.green : Colors.grey,
                    child: Icon(
                      rol == 'admin'
                          ? Icons.admin_panel_settings
                          : rol == 'medico'
                          ? Icons.medical_services
                          : Icons.local_hospital, // Enfermero
                      color: Colors.white,
                    ),
                  ),
                  title: Text(
                    nombre,
                    style: TextStyle(
                      decoration: activo ? null : TextDecoration.lineThrough,
                      color: activo ? null : Colors.grey,
                    ),
                  ),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('$email • $rol'),
                      if (!activo)
                        const Text(
                          'Inactivo',
                          style: TextStyle(
                            color: Colors.red,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                    ],
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Switch(
                        value: activo,
                        onChanged: (val) => _toggleStatus(id, activo),
                        activeColor: Colors.green,
                      ),
                      IconButton(
                        icon: const Icon(Icons.lock_reset),
                        onPressed: () => _showChangePasswordDialog(id),
                        tooltip: 'Cambiar Contraseña',
                      ),
                    ],
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const CreateUsuario()),
          ).then((_) => _loadUsuarios());
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
