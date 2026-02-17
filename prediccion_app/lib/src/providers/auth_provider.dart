import 'package:flutter/material.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  String? _token;
  String? _role;
  bool _isLoading = false;
  String? _errorMessage;

  String? get token => _token;
  String? get role => _role;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _token != null;

  bool get isAdmin => _role == 'admin';
  bool get isMedico => _role == 'medico';

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _token = await _apiService.login(email, password);
      Map<String, dynamic> decodedToken = JwtDecoder.decode(_token!);
      _role = decodedToken['rol']; // Ensure backend sends 'rol' in payload
      _apiService.setToken(_token!);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  void logout() {
    _token = null;
    _role = null;
    notifyListeners();
  }
}
