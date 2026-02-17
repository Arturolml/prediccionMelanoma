import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/lesion_model.dart';
import '../models/evaluation_model.dart';

class LesionProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  List<Lesion> _lesions = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<Lesion> get lesions => _lesions;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchLesions(int patientId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _lesions = await _apiService.getLesions(patientId);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<bool> addLesion(Lesion lesion) async {
    try {
      final newLesion = await _apiService.createLesion(lesion);
      _lesions.add(newLesion);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<Evaluation?> evaluateLesion(Evaluation evaluation) async {
    try {
      return await _apiService.createEvaluation(evaluation);
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return null;
    }
  }
}
