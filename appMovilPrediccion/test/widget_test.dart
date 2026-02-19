// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app_1/presentation/screens/crear_paciente.dart';

void main() {
  testWidgets('CrearPaciente form smoke test', (WidgetTester tester) async {
    // Build our app with CrearPaciente as home
    await tester.pumpWidget(const MaterialApp(home: CrearPaciente()));

    // Verify identity fields
    expect(find.text('Crear Paciente'), findsOneWidget); // AppBar title
    expect(find.text('Nombres'), findsOneWidget);
    expect(find.text('Apellido Paterno'), findsOneWidget);
    expect(find.text('CURP'), findsOneWidget);

    // Verify dermatology fields
    expect(find.textContaining('Fototipo de Fitzpatrick'), findsOneWidget);
    expect(
      find.text('Antecedentes Familiares de problemas en piel'),
      findsOneWidget,
    );
  });
}
