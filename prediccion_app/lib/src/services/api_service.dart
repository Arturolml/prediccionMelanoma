import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:path/path.dart';
import '../models/lesion_model.dart';
import '../models/evaluation_model.dart';

class ApiService {
  static String get baseUrl {
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
  }

  String? _token;

  void setToken(String token) {
    _token = token;
  }

  Map<String, String> get _headers {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (_token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  Future<String> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );

    if (response.statusCode == 201 || response.statusCode == 200) {
      final data = jsonDecode(response.body);
      _token = data['access_token'];
      return _token!;
    } else {
      throw Exception('Failed to login: ${response.body}');
    }
  }

  Future<List<Lesion>> getLesions(int patientId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/lesiones?id_paciente=$patientId'),
      headers: _headers,
    );

    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body);
      return data.map((json) => Lesion.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load lesions');
    }
  }

  Future<Lesion> createLesion(Lesion lesion) async {
    final response = await http.post(
      Uri.parse('$baseUrl/lesiones'),
      headers: _headers,
      body: jsonEncode(lesion.toJson()),
    );

    if (response.statusCode == 201) {
      return Lesion.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Failed to create lesion');
    }
  }

  Future<String> uploadImage(File imageFile) async {
    var uri = Uri.parse('$baseUrl/evaluaciones/upload');
    var request = http.MultipartRequest('POST', uri);
    request.headers.addAll(_headers); // Add headers if any (usually auth)

    var stream = http.ByteStream(imageFile.openRead());
    var length = await imageFile.length();

    var multipartFile = http.MultipartFile(
      'imagen',
      stream,
      length,
      filename: basename(imageFile.path),
      contentType: MediaType(
        'image',
        'jpeg',
      ), // Adjust based on file type if needed
    );

    request.files.add(multipartFile);
    var response = await request.send();

    if (response.statusCode == 201 || response.statusCode == 200) {
      var responseData = await response.stream.bytesToString();
      var json = jsonDecode(responseData);
      return json['url']; // Returns relative path e.g., /uploads/filename.jpg
    } else {
      throw Exception('Failed to upload image');
    }
  }

  Future<Evaluation> createEvaluation(Evaluation evaluation) async {
    final response = await http.post(
      Uri.parse('$baseUrl/evaluaciones'),
      headers: _headers,
      body: jsonEncode(evaluation.toJson()),
    );

    if (response.statusCode == 201) {
      return Evaluation.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Failed to create evaluation: ${response.body}');
    }
  }
}
