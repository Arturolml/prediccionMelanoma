import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_app_1/services/database_helper.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();

  factory ApiService() {
    return _instance;
  }

  ApiService._internal();

  /// URL del backend. En producción va detrás de /apiprediccion; para una
  /// red local se cambia al compilar:
  ///   flutter run --dart-define=API_BASE_URL=http://192.168.100.20:3007
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://liaaproyectos.uaz.edu.mx/apiprediccion',
  );

  /// Socket.IO: el origen va sin la ruta (si no, la ruta se toma como
  /// namespace) y la ruta del proxy va en `path`, igual que en la web.
  static String get socketOrigin => Uri.parse(baseUrl).origin;
  static String get socketPath {
    final ruta = Uri.parse(baseUrl).path;
    final base = ruta.endsWith('/') ? ruta.substring(0, ruta.length - 1) : ruta;
    return '$base/socket.io';
  }
  String? _token;
  int? currentUserid;

  // --- Auth ---

  /// Último motivo de falla del login, para mostrarlo al usuario.
  String? lastLoginError;

  Future<bool> login(String email, String password) async {
    lastLoginError = null;
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
          lastLoginError =
              'Sin conexión a Internet y no hay una sesión guardada para este correo.';
          return false;
        }
      }

      // ONLINE LOGIN
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password}),
      ).timeout(const Duration(seconds: 20));

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
        lastLoginError = response.statusCode == 401
            ? 'Correo o contraseña incorrectos.'
            : 'El servidor respondió con error ${response.statusCode}.';
        return false;
      }
    } on TimeoutException {
      lastLoginError = 'El servidor no respondió a tiempo ($baseUrl).';
      return false;
    } on SocketException catch (e) {
      lastLoginError = 'No se pudo conectar con el servidor: ${e.message}';
      return false;
    } on HandshakeException catch (e) {
      lastLoginError = 'Error de certificado HTTPS: ${e.message}';
      return false;
    } catch (e) {
      print('❌ Excepción en login: $e');
      lastLoginError = 'Error inesperado: $e';
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

  /// La foto como parte multipart con su tipo MIME. El backend solo acepta
  /// image/jpeg, image/png e image/webp; sin contentType, http manda
  /// application/octet-stream y la foto se rechaza.
  Future<http.MultipartFile> _imagenMultipart(File imageFile) async {
    final nombre = imageFile.uri.pathSegments.last;
    final ext = nombre.contains('.') ? nombre.split('.').last.toLowerCase() : '';
    final subtipo = switch (ext) {
      'png' => 'png',
      'webp' => 'webp',
      _ => 'jpeg',
    };
    return http.MultipartFile(
      'imagen',
      http.ByteStream(imageFile.openRead()),
      await imageFile.length(),
      filename: nombre,
      contentType: MediaType('image', subtipo),
    );
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

  /// Corrige el sitio anatómico de una lesión existente.
  Future<bool> updateLesionSitio(int id, String sitioAnatomico) async {
    try {
      final response = await http.patch(
        Uri.parse('$baseUrl/lesiones/$id'),
        headers: _authHeaders,
        body: jsonEncode({'sitio_anatomico': sitioAnatomico}),
      );
      return response.statusCode == 200;
    } catch (e) {
      print('❌ Excepción actualizando lesión: $e');
      return false;
    }
  }

  // --- Evaluaciones (con Imagen) ---

  /// Pide el análisis de una evaluación que se guardó porque la IA no respondió.
  /// Devuelve la evaluación actualizada o null si la IA sigue sin responder.
  Future<Map<String, dynamic>?> reanalizarEvaluacion(dynamic id) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/evaluaciones/$id/reanalizar'),
        headers: _authHeaders,
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }
      print('❌ Error reanalizando evaluación: ${response.statusCode}');
      return null;
    } catch (e) {
      print('❌ Excepción reanalizando evaluación: $e');
      return null;
    }
  }

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
      request.files.add(await _imagenMultipart(imageFile));

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

        request.files.add(await _imagenMultipart(imageFile));

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

  /// Último motivo de falla del análisis con la IA, para mostrarlo al usuario.
  String? lastPredictError;

  /// Análisis en vivo con la IA. El backend necesita el paciente (o la
  /// lesión) para mandar edad y sexo a la IA, y el sitio anatómico.
  Future<Map<String, dynamic>?> predictEvaluacionLive(
    File imageFile, {
    int? idPaciente,
    int? idLesion,
    String? sitioAnatomico,
    double? anchoCampoMm,
  }) async {
    lastPredictError = null;
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
      if (anchoCampoMm != null) {
        request.fields['ancho_campo_mm'] = '$anchoCampoMm';
      }

      request.files.add(await _imagenMultipart(imageFile));

      var response = await request.send().timeout(const Duration(seconds: 60));

      if (response.statusCode == 201 || response.statusCode == 200) {
        final respStr = await response.stream.bytesToString();
        print('✅ Predicción Live exitosa: $respStr');
        return jsonDecode(respStr) as Map<String, dynamic>;
      } else {
        final respStr = await response.stream.bytesToString();
        print('❌ Error en predicción live: $respStr');
        String detalle = respStr;
        try {
          final body = jsonDecode(respStr);
          if (body is Map && body['message'] != null) {
            detalle = body['message'].toString();
          }
        } catch (_) {}
        if (detalle.length > 200) detalle = detalle.substring(0, 200);
        lastPredictError = switch (response.statusCode) {
          401 => 'Sesión no válida o vencida. Cierre sesión y vuelva a entrar.',
          403 =>
            'Su usuario no tiene permiso para analizar (solo médico o enfermero).',
          413 => 'La imagen es demasiado grande para el servidor.',
          _ => 'Error ${response.statusCode} del servidor: $detalle',
        };
        return null;
      }
    } on TimeoutException {
      lastPredictError = 'El servidor no respondió en 60 segundos.';
      return null;
    } on SocketException catch (e) {
      lastPredictError = 'No se pudo conectar con el servidor: ${e.message}';
      return null;
    } catch (e) {
      print('❌ Excepción en predicción live: $e');
      lastPredictError = 'Error inesperado: $e';
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
