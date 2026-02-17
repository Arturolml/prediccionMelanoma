import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/lesion_provider.dart';
import '../providers/auth_provider.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    // Fetch lesions for a default patient ID (e.g., 1) or current user's patient ID.
    // Ideally, the backend would return lesions for the logged-in user or we fetch based on user role.
    // For this MVP, we'll hardcode patientId = 1 or use a dummy ID.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<LesionProvider>(context, listen: false).fetchLesions(1);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mis Lesiones'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              Provider.of<AuthProvider>(context, listen: false).logout();
              Navigator.pushReplacementNamed(context, '/login');
            },
          ),
        ],
      ),
      drawer: Consumer<AuthProvider>(
        builder: (context, auth, _) => Drawer(
          child: ListView(
            children: [
              const DrawerHeader(child: Text('Menú')),
              if (auth.isAdmin)
                ListTile(
                  leading: const Icon(Icons.person_add),
                  title: const Text('Crear Usuario'),
                  onTap: () => Navigator.pushNamed(context, '/create_user'),
                ),
              if (auth.isMedico)
                ListTile(
                  leading: const Icon(Icons.medical_services),
                  title: const Text('Crear Paciente'),
                  onTap: () => Navigator.pushNamed(context, '/create_patient'),
                ),
            ],
          ),
        ),
      ),
      body: Consumer<LesionProvider>(
        builder: (context, lesionProvider, child) {
          if (lesionProvider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (lesionProvider.errorMessage != null) {
            return Center(child: Text('Error: ${lesionProvider.errorMessage}'));
          }

          if (lesionProvider.lesions.isEmpty) {
            return const Center(
              child: Text('No se encontraron lesiones. ¡Agrega una!'),
            );
          }

          return ListView.builder(
            itemCount: lesionProvider.lesions.length,
            itemBuilder: (context, index) {
              final lesion = lesionProvider.lesions[index];
              return ListTile(
                title: Text(lesion.zonaCuerpo),
                subtitle: Text(lesion.notasUbicacion ?? 'Sin descripción'),
                trailing: const Icon(Icons.arrow_forward_ios),
                onTap: () {
                  // Navigate to evaluation screen or details
                  Navigator.pushNamed(
                    context,
                    '/evaluation',
                    arguments: lesion,
                  );
                },
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.pushNamed(context, '/add_lesion');
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
