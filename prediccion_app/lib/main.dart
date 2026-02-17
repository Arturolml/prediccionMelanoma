import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'src/providers/auth_provider.dart';
import 'src/providers/lesion_provider.dart';
import 'src/screens/login_screen.dart';
import 'src/screens/home_screen.dart';
import 'src/screens/add_lesion_screen.dart';
import 'src/screens/evaluation_screen.dart';
import 'src/screens/create_user_screen.dart';
import 'src/screens/create_patient_screen.dart';
import 'src/models/lesion_model.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => LesionProvider()),
      ],
      child: MaterialApp(
        title: 'Predicción Melanoma',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.teal),
          useMaterial3: true,
        ),
        initialRoute: '/login',
        routes: {
          '/login': (context) => const LoginScreen(),
          '/home': (context) => const HomeScreen(),
          '/add_lesion': (context) => const AddLesionScreen(),
          '/create_user': (context) => const CreateUserScreen(),
          '/create_patient': (context) => const CreatePatientScreen(),
        },
        onGenerateRoute: (settings) {
          if (settings.name == '/evaluation') {
            final lesion = settings.arguments as Lesion;
            return MaterialPageRoute(
              builder: (context) => EvaluationScreen(lesion: lesion),
            );
          }
          return null;
        },
      ),
    );
  }
}
