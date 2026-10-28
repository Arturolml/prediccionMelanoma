import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_app_1/services/database_helper.dart';

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
      var connectivityResult = await (Connectivity().checkConnectivity());
      bool isOffline = connectivityResult.contains(ConnectivityResult.none);

      if (isOffline) {
        print('📡 Sin conexión. Intentando login offline...');
        final prefs = await SharedPreferences.getInstance();
        final cachedEmail = prefs.getString('cached_email');
        final cachedToken = prefs.getString('cached_token');

        if (cachedEmail != null &&
            cachedEmail == email &&
            cachedToken != null) {
          _token = cachedToken;
          _decodeTokenAndSetUser();
          print('✅ Login offline exitoso (usando credenciales cacheadas).');
          return true;
        } else {
          print(
            '❌ Login offline fallido: no hay credenciales cacheadas o no coinciden.',
          );
          return false;
        }
      }

      // ONLINE LOGIN
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password}),
      );

      if (response.statusCode == 201) {
        final data = jsonDecode(response.body);
        _token = data['access_token'];

        _decodeTokenAndSetUser();

        // Cache for offline
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('cached_email', email);
        await prefs.setString('cached_token', _token!);

        print('✅ Login exitoso. Token obtenido y guardado.');
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

  void _decodeTokenAndSetUser() {
    try {
      if (_token == null) return;
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
  }

  String? get token => _token;

  /// La foto de una evaluación ya no se sirve en público (/uploads): se pide a
  /// este endpoint con [imagenHeaders].
  static String urlImagenEvaluacion(dynamic idEvaluacion) =>
      '$baseUrl/evaluaciones/$idEvaluacion/imagen';

  Map<String, String> get imagenHeaders => {
    if (_token != null) 'Authorization': 'Bearer $_token',
  };

  Map<String, String> get _authHeaders {
    return {
      'Content-Type': 'application/json',
      if (_token != null) 'Authorization': 'Bearer $_token',
    };
  }

  // --- Pacientes ---

  Future<bool> createPaciente(Map<String, dynamic> data) async {
    try {
      var connectivityResult = await (Connectivity().checkConnectivity());
      bool isOffline = !connectivityResult.contains(ConnectivityResult.wifi);

      if (isOffline) {
        print('📡 Sin Wi-Fi. Guardando paciente localmente...');
        await DatabaseHelper.instance.insertPendingPaciente(data);
        return true;
      }

      // ONLINE
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
      print('⏳ Falló red durante envío. Guardando paciente localmente...');
      await DatabaseHelper.instance.insertPendingPaciente(data);
      return true;
    }
  }

  Future<List<Map<String, dynamic>>> getPacientes() async {
    try {
      // Trigger background sync when requesting patients list (meaning user is likely in the main menu)
      syncOfflineData();

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
      // 1. Check Internet Connection (Requiere WiFi para no gastar datos al subir imagen)
      var connectivityResult = await (Connectivity().checkConnectivity());
      bool isOffline = !connectivityResult.contains(ConnectivityResult.wifi);

      if (isOffline) {
        // Save to DatabaseHelper locally
        print('📡 Sin conexión. Guardando evaluación localmente...');
        await DatabaseHelper.instance.insertPendingEvaluacion(
          data,
          imageFile.path,
        );

        // Return 2 to indicate "saved offline" (bool is not enough, changing to returning an int status or throwing custom exceptions.
        // For backwards compatibility let's return true, but print warning.
        return true;
      }

      // ONLINE FLOW
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

      // Fallback: Si marca error (como timeout) también lo guardamos local
      print('⏳ Falló red durante envío. Guardando localmente...');
      await DatabaseHelper.instance.insertPendingEvaluacion(
        data,
        imageFile.path,
      );
      return true; // We return true since it's queued safely
    }
  }

  // --- Sincronización Offline ---
  Future<void> syncOfflineData() async {
    print('🔄 Iniciando sincronización de datos offline...');

    var connectivityResult = await (Connectivity().checkConnectivity());
    if (!connectivityResult.contains(ConnectivityResult.wifi)) {
      print(
        '🚫 Sincronización abortada: Se requiere Wi-Fi para no gastar datos móviles.',
      );
      return;
    }

    await _syncPendientesPacientes();
    await _syncPendientesEvaluaciones();
  }

  Future<void> _syncPendientesPacientes() async {
    final pendientes = await DatabaseHelper.instance.getPendingPacientes();

    if (pendientes.isEmpty) return;
    print('📦 ${pendientes.length} pacientes pendientes encontrados.');

    for (var row in pendientes) {
      try {
        int dbId = row['id'];
        Map<String, dynamic> data = jsonDecode(row['json_data']);

        print('📤 Sincronizando paciente #$dbId...');
        final response = await http.post(
          Uri.parse('$baseUrl/pacientes'),
          headers: _authHeaders,
          body: jsonEncode(data),
        );

        if (response.statusCode == 201) {
          print('✅ Paciente #$dbId sincronizado con éxito.');
          await DatabaseHelper.instance.deletePendingPaciente(dbId);
        } else {
          print(
            '❌ Falló sincronización paciente #$dbId (HTTP ${response.statusCode})',
          );
        }
      } catch (e) {
        print('❌ Error durante iteración de sincronización paciente: $e');
      }
    }
  }

  Future<void> _syncPendientesEvaluaciones() async {
    final pendientes = await DatabaseHelper.instance.getPendingEvaluaciones();

    if (pendientes.isEmpty) {
      print('✨ No hay evaluaciones pendientes por sincronizar.');
      return;
    }

    print('📦 ${pendientes.length} evaluaciones pendientes encontradas.');

    for (var row in pendientes) {
      try {
        int dbId = row['id'];
        String imagePath = row['image_path'];
        Map<String, dynamic> data = jsonDecode(row['json_data']);

        File imageFile = File(imagePath);

        if (!imageFile.existsSync()) {
          print('⚠️ Archivo de imagen $imagePath no encontrado. Omitiendo.');
          continue;
        }

        // Intentamos mandar
        print('📤 Sincronizando evaluación #$dbId...');

        var request = http.MultipartRequest(
          'POST',
          Uri.parse('$baseUrl/evaluaciones'),
        );
        if (_token != null) {
          request.headers['Authorization'] = 'Bearer $_token';
        }
        data.forEach((key, value) {
          request.fields[key] = value.toString();
        });

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
          print('✅ Evaluación #$dbId sincronizada con éxito.');
          await DatabaseHelper.instance.deletePendingEvaluacion(dbId);

          // Opcional: Borrar imagen cache local si se desea ahorrar espacio
          // imageFile.deleteSync();
        } else {
          print('❌ Falló sincronización #$dbId (HTTP ${response.statusCode})');
        }
      } catch (e) {
        print('❌ Error durante iteración de sincronización: $e');
      }
    }
  }

  // --- Evaluaciones (Predict Live) ---

  /// Análisis en vivo con la IA. El backend necesita el paciente (o la
  /// lesión) para mandar edad y sexo a la IA, y el sitio anatómico.
  Future<Map<String, dynamic>?> predictEvaluacionLive(
    File imageFile, {
    int? idPaciente,
    int? idLesion,
    String? sitioAnatomico,
  }) async {
    try {
      var request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/evaluaciones/predict-live'),
      );
      if (_token != null) {
        request.headers['Authorization'] = 'Bearer $_token';
      }
      if (idLesion != null) request.fields['id_lesion'] = '$idLesion';
      if (idPaciente != null) request.fields['id_paciente'] = '$idPaciente';
      if (sitioAnatomico != null) {
        request.fields['sitio_anatomico'] = sitioAnatomico;
      }

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

      if (response.statusCode == 201 || response.statusCode == 200) {
        final respStr = await response.stream.bytesToString();
        print('✅ Predicción Live exitosa: $respStr');
        return jsonDecode(respStr) as Map<String, dynamic>;
      } else {
        final respStr = await response.stream.bytesToString();
        print('❌ Error en predicción live: $respStr');
        return null;
      }
    } catch (e) {
      print('❌ Excepción en predicción live: $e');
      return null;
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
