import 'dart:async';
import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_app_1/presentation/screens/pacientes.dart';
import 'package:flutter_app_1/presentation/screens/usuarios.dart';
import 'package:flutter_app_1/services/api_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

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
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _login() async {
    if (_formKey.currentState!.validate()) {
      final email = _emailController.text;
      final password = _passwordController.text;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _isOffline ? 'Intentando sesión sin red...' : 'Iniciando sesión...',
          ),
        ),
      );

      final success = await ApiService().login(email, password);

      if (!mounted) return;

      if (success) {
        // En un caso real, decodificaríamos el token para saber el rol.
        // Por ahora, para mantener la lógica de navegación existente:
        String role = 'medico';
        if (email.contains('admin')) {
          role = 'admin';
        } else if (email.contains('enfermero')) {
          role = 'enfermero';
        }

        if (role == 'admin') {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const UsuariosScreen()),
          );
        } else {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const PacientesScreen()),
          );
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Error en login. Verifique credenciales.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Logo or App Name
                Image.asset(
                  'assets/images/logo.jpeg',
                  height: 120,
                  fit: BoxFit.contain,
                ),
                const SizedBox(height: 24),
                const Text(
                  'Bienvenido',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 10),
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
                            'Sin Conexión. Iniciando sesión con datos guardados de accesos anteriores.',
                            style: TextStyle(color: Colors.orange.shade900),
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 10),

                // Email Field
                TextFormField(
                  controller: _emailController,
                  decoration: const InputDecoration(
                    labelText: 'Correo Electrónico',
                    prefixIcon: Icon(Icons.email),
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.emailAddress,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Por favor ingrese su correo';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Password Field
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: 'Contraseña',
                    prefixIcon: const Icon(Icons.lock),
                    border: const OutlineInputBorder(),
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
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Por favor ingrese su contraseña';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 24),

                // Login Button
                ElevatedButton(
                  onPressed: _login,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: const Text(
                    'Iniciar Sesión',
                    style: TextStyle(fontSize: 18),
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
