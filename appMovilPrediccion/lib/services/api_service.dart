import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

class ApiService {
  static final ApiService _instance = ApiService._internal();

  factory ApiService() {
    return _instance;
  }

  ApiService._internal();

  //static const String baseUrl = 'https://liaaproyectos.uaz.edu.mx';
  static const String baseUrl = 'http://192.168.100.20:3007';
  String? _token;
  int? currentUserid;

  // --- Auth ---

  Future<bool> login(String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password}),
      );

      if (response.statusCode == 201) {
        final data = jsonDecode(response.body);
        _token = data['access_token'];

        try {
          final parts = _token!.split('.');
          if (parts.length == 3) {
            String payload = parts[1];
            payload = payload.replaceAll('-', '+').replaceAll('_', '/');
            switch (payload.length % 4) {
              case 0:
                break;
              case 2:
                payload += '==';
                break;
              case 3:
                payload += '=';
                break;
              default:
                throw Exception('Illegal base64url string!');
            }
            final decodedPayload = utf8.decode(base64Url.decode(payload));
            final payloadMap = jsonDecode(decodedPayload);
            currentUserid =
                payloadMap['userId'] ??
                payloadMap['id_usuario'] ??
                payloadMap['sub'];
          }
        } catch (e) {
          print('Error decoding token: $e');
        }

        print('✅ Login exitoso. Token obtenido.');
        return true;
      } else {
        print('❌ Error en login: ${response.body}');
        return false;
      }
    } catch (e) {
      print('❌ Excepción en login: $e');
      return false;
    }
  }

  Map<String, String> get _authHeaders {
    return {
      'Content-Type': 'application/json',
      if (_token != null) 'Authorization': 'Bearer $_token',
    };
  }

  // --- Pacientes ---

  Future<bool> createPaciente(Map<String, dynamic> data) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/pacientes'),
        headers: _authHeaders,
        body: jsonEncode(data),
      );

      if (response.statusCode == 201) {
        print('✅ Paciente creado: ${response.body}');
        return true;
      } else {
        print('❌ Error creando paciente: ${response.body}');
        return false;
      }
    } catch (e) {
      print('❌ Excepción creando paciente: $e');
      return false;
    }
  }

  Future<List<Map<String, dynamic>>> getPacientes() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/pacientes'),
        headers: _authHeaders,
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.cast<Map<String, dynamic>>();
      } else {
        print('❌ Error obteniendo pacientes: ${response.body}');
        return [];
      }
    } catch (e) {
      print('❌ Excepción obteniendo pacientes: $e');
      return [];
    }
  }

  // --- Usuarios ---

  Future<bool> createUsuario(Map<String, dynamic> data) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/usuarios'),
        headers: _authHeaders,
        body: jsonEncode(data),
      );

      if (response.statusCode == 201) {
        print('✅ Usuario creado: ${response.body}');
        return true;
      } else {
        print('❌ Error creando usuario: ${response.body}');
        return false;
      }
    } catch (e) {
      print('❌ Excepción creando usuario: $e');
      return false;
    }
  }

  Future<List<Map<String, dynamic>>> getUsuarios() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/usuarios'),
        headers: _authHeaders,
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.cast<Map<String, dynamic>>();
      } else {
        print('❌ Error obteniendo usuarios: ${response.body}');
        return [];
      }
    } catch (e) {
      print('❌ Excepción obteniendo usuarios: $e');
      return [];
    }
  }

  Future<bool> updateUsuario(int id, Map<String, dynamic> data) async {
    try {
      final response = await http.patch(
        Uri.parse('$baseUrl/usuarios/$id'),
        headers: _authHeaders,
        body: jsonEncode(data),
      );

      if (response.statusCode == 200) {
        print('✅ Usuario actualizado: ${response.body}');
        return true;
      } else {
        print('❌ Error actualizando usuario: ${response.body}');
        return false;
      }
    } catch (e) {
      print('❌ Excepción actualizando usuario: $e');
      return false;
    }
  }

  Future<bool> toggleUsuarioStatus(int id, bool activo) async {
    try {
      final response = await http.patch(
        Uri.parse('$baseUrl/usuarios/$id/status'),
        headers: _authHeaders,
        body: jsonEncode({'activo': activo}),
      );

      if (response.statusCode == 200) {
        print('✅ Estado de usuario actualizado: ${response.body}');
        return true;
      } else {
        print('❌ Error actualizando estado de usuario: ${response.body}');
        return false;
      }
    } catch (e) {
      print('❌ Excepción actualizando estado de usuario: $e');
      return false;
    }
  }

  // --- Lesiones ---

  Future<int?> createLesion(Map<String, dynamic> data) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/lesiones'),
        headers: _authHeaders,
        body: jsonEncode(data),
      );

      if (response.statusCode == 201) {
        final body = jsonDecode(response.body);
        print('✅ Lesión creada: ${response.body}');
        return body['id_lesion'];
      } else {
        print('❌ Error creando lesión: ${response.body}');
        return null;
      }
    } catch (e) {
      print('❌ Excepción creando lesión: $e');
      return null;
    }
  }

  // --- Evaluaciones (con Imagen) ---

  Future<bool> createEvaluacion(
    Map<String, dynamic> data,
    File imageFile,
  ) async {
    try {
      var request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/evaluaciones'),
      );
      if (_token != null) {
        request.headers['Authorization'] = 'Bearer $_token';
      }

      // Agregar campos de texto
      data.forEach((key, value) {
        request.fields[key] = value.toString();
      });

      // Agregar imagen
      var stream = http.ByteStream(imageFile.openRead());
      var length = await imageFile.length();
      var multipartFile = http.MultipartFile(
        'imagen',
        stream,
        length,
        filename: imageFile.path.split('/').last,
      );
      request.files.add(multipartFile);

      var response = await request.send();

      if (response.statusCode == 201) {
        final respStr = await response.stream.bytesToString();
        print('✅ Evaluación creada: $respStr');
        return true;
      } else {
        final respStr = await response.stream.bytesToString();
        print('❌ Error creando evaluación: $respStr');
        return false;
      }
    } catch (e) {
      print('❌ Excepción creando evaluación: $e');
      return false;
    }
  }

  Future<List<Map<String, dynamic>>> getEvaluaciones(int pacienteId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/evaluaciones?id_paciente=$pacienteId'),
        headers: _authHeaders,
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.cast<Map<String, dynamic>>();
      } else {
        print('❌ Error obteniendo evaluaciones: ${response.body}');
        return [];
      }
    } catch (e) {
      print('❌ Excepción obteniendo evaluaciones: $e');
      return [];
    }
  }

  // --- Util ---
  Future<void> checkConnection() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/'));
      if (response.statusCode == 200) {
        print('✅ Conexión exitosa con el backend: ${response.body}');
      } else {
        print(
          '⚠️ Conexión establecida pero con estado: ${response.statusCode}',
        );
      }
    } catch (e) {
      print('❌ Error al conectar con el backend: $e');
    }
  }
}
