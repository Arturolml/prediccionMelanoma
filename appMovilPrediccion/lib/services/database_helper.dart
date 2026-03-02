import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class DatabaseHelper {
  static final DatabaseHelper instance = DatabaseHelper._init();
  static Database? _database;

  DatabaseHelper._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('evaluaciones_offline.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(path, version: 1, onCreate: _createDB);
  }

  Future _createDB(Database db, int version) async {
    await db.execute('''
      CREATE TABLE evaluaciones_pendientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_lesion INTEGER NOT NULL,
        json_data TEXT NOT NULL,
        image_path TEXT NOT NULL,
        fecha_creacion TEXT NOT NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE pacientes_pendientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        json_data TEXT NOT NULL,
        fecha_creacion TEXT NOT NULL
      )
    ''');
  }

  // Insert a new pending evaluation
  Future<int> insertPendingEvaluacion(
    Map<String, dynamic> data,
    String imagePath,
  ) async {
    final db = await instance.database;

    // Convert to JSON string
    final dataString = jsonEncode(data);

    return await db.insert('evaluaciones_pendientes', {
      'id_lesion': data['id_lesion'],
      'json_data': dataString,
      'image_path': imagePath,
      'fecha_creacion': DateTime.now().toIso8601String(),
    });
  }

  // Get all pending evaluations
  Future<List<Map<String, dynamic>>> getPendingEvaluaciones() async {
    final db = await instance.database;
    return await db.query(
      'evaluaciones_pendientes',
      orderBy: 'fecha_creacion ASC',
    );
  }

  // Delete a pending evaluation after successful sync
  Future<int> deletePendingEvaluacion(int id) async {
    final db = await instance.database;
    return await db.delete(
      'evaluaciones_pendientes',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // --- PACIENTES OFFLINE ---

  // Insert a new pending patient
  Future<int> insertPendingPaciente(Map<String, dynamic> data) async {
    final db = await instance.database;
    final dataString = jsonEncode(data);

    return await db.insert('pacientes_pendientes', {
      'json_data': dataString,
      'fecha_creacion': DateTime.now().toIso8601String(),
    });
  }

  // Get all pending patients
  Future<List<Map<String, dynamic>>> getPendingPacientes() async {
    final db = await instance.database;
    return await db.query(
      'pacientes_pendientes',
      orderBy: 'fecha_creacion ASC',
    );
  }

  // Delete a pending patient
  Future<int> deletePendingPaciente(int id) async {
    final db = await instance.database;
    return await db.delete(
      'pacientes_pendientes',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // Close DB
  Future close() async {
    final db = await instance.database;
    db.close();
  }
}
