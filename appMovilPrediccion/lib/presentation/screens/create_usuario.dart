import 'package:flutter/material.dart';
import 'package:flutter_app_1/services/api_service.dart';

class CreateUsuario extends StatefulWidget {
  const CreateUsuario({super.key});

  @override
  State<CreateUsuario> createState() => _CreateUsuarioState();
}

class _CreateUsuarioState extends State<CreateUsuario> {
  final _formKey = GlobalKey<FormState>();

  // Controllers
  final _nombreController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _cedulaController = TextEditingController();
  final _telefonoController = TextEditingController();

  // State variables
  String? _rol = 'medico';
  bool _activo = true;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _nombreController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _cedulaController.dispose();
    _telefonoController.dispose();
    super.dispose();
  }

  void _submitForm() async {
    if (_formKey.currentState!.validate()) {
      final userData = {
        'nombre_completo': _nombreController.text,
        'email': _emailController.text,
        'password': _passwordController.text,
        'rol': _rol,
        'cedula_profesional': _cedulaController.text,
        'telefono_contacto': _telefonoController.text,
        'activo': _activo,
      };

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Guardando usuario...')));

      final success = await ApiService().createUsuario(userData);

      if (!mounted) return;

      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Usuario creado exitosamente')),
        );
        Navigator.pop(context);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Error al crear usuario'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Crear Usuario')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Nombre Completo
              TextFormField(
                controller: _nombreController,
                decoration: const InputDecoration(
                  labelText: 'Nombre Completo',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.person),
                ),
                maxLength: 150,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Por favor ingrese el nombre completo';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // 2. Email
              TextFormField(
                controller: _emailController,
                decoration: const InputDecoration(
                  labelText: 'Email',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.email),
                ),
                keyboardType: TextInputType.emailAddress,
                maxLength: 150,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Por favor ingrese el email';
                  }
                  if (!value.contains('@')) {
                    // Basic email validation
                    return 'Ingrese un email válido';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // 3. Password Hash
              TextFormField(
                controller: _passwordController,
                decoration: InputDecoration(
                  labelText: 'Contraseña',
                  border: const OutlineInputBorder(),
                  prefixIcon: const Icon(Icons.lock),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword
                          ? Icons.visibility
                          : Icons.visibility_off,
                    ),
                    onPressed: () {
                      setState(() {
                        _obscurePassword = !_obscurePassword;
                      });
                    },
                  ),
                ),
                obscureText: _obscurePassword,
                maxLength: 255,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Por favor ingrese una contraseña';
                  }
                  if (value.length < 6) {
                    return 'La contraseña debe tener al menos 6 caracteres';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // 4. Rol
              DropdownButtonFormField<String>(
                initialValue: _rol,
                decoration: const InputDecoration(
                  labelText: 'Rol',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.admin_panel_settings),
                ),
                items: const [
                  DropdownMenuItem(value: 'medico', child: Text('Medico')),
                  DropdownMenuItem(
                    value: 'enfermero',
                    child: Text('Enfermero'),
                  ),
                  DropdownMenuItem(
                    value: 'admin',
                    child: Text('Administrador'),
                  ),
                ],
                onChanged: (value) {
                  setState(() {
                    _rol = value;
                  });
                },
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Por favor seleccione un rol';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // 5. Cédula Profesional (Optional)
              TextFormField(
                controller: _cedulaController,
                decoration: const InputDecoration(
                  labelText: 'Cédula Profesional (Opcional)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.badge),
                ),
                maxLength: 50,
              ),
              const SizedBox(height: 16),

              // 6. Teléfono de Contacto (Optional)
              TextFormField(
                controller: _telefonoController,
                decoration: const InputDecoration(
                  labelText: 'Teléfono de Contacto (Opcional)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.phone),
                ),
                keyboardType: TextInputType.phone,
                maxLength: 20,
              ),
              const SizedBox(height: 16),

              // 7. Activo
              SwitchListTile(
                title: const Text('Activo'),
                value: _activo,
                onChanged: (bool value) {
                  setState(() {
                    _activo = value;
                  });
                },
                secondary: const Icon(Icons.check_circle_outline),
              ),
              const SizedBox(height: 24),

              // Submit Button
              ElevatedButton(
                onPressed: _submitForm,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  textStyle: const TextStyle(fontSize: 18),
                ),
                child: const Text('Crear Usuario'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
