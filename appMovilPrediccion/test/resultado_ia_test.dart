import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app_1/constants/alertas.dart';
import 'package:flutter_app_1/presentation/widgets/resultado_ia.dart';

// PNG de 1x1 en base64, como los mapas que manda la API de IA en el análisis en vivo.
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

Map<String, dynamic> resultado({required bool revisar, Map<String, dynamic>? evolucion}) => {
  'version_modelos': 'fase14-2026-10-26',
  'politica': 'consulta',
  'decision': 'sin_sospecha',
  'revisar_caso': revisar,
  'coinciden': !revisar,
  'mensaje': 'Sin sospecha de malignidad — la segunda opinión discrepa: revisar el caso',
  'metadatos_usados': {'edad': '66', 'sexo': 'female', 'sitio': 'back'},
  'fusion': {
    'prob_maligno': 0.141, 'umbral': 0.2079, 'sospecha': false, 'prob_sin_metadatos': 0.106,
    'prob_por_semilla': [0.10, 0.12, 0.20],
    'aporte_metadatos': {'edad': 0.032, 'sexo': 0.007, 'sitio': -0.004},
  },
  'qresnet': {'prob_maligno': 0.421, 'umbral': 0.2263, 'sospecha': true, 'prob_por_semilla': [0.20, 0.45, 0.61]},
  'abcde': {
    'asimetria': false, 'bordes_irregulares': false, 'color_variable': false, 'n_colores': 2,
    'colores': ['marron_claro', 'blanco'], 'diametro_mm': null, 'evolucion': evolucion,
    'advertencias': ['sin escala: el diámetro no se informa en mm'],
  },
  'imagenes': {'mapa_fusion_png': png, 'mapa_qresnet_png': png, 'contorno_lesion_png': png},
};

Future<void> mostrar(WidgetTester tester, Map<String, dynamic> r) => tester.pumpWidget(
  MaterialApp(home: Scaffold(body: SingleChildScrollView(child: ResultadoIAView(resultado: r)))),
);

void main() {
  testWidgets('muestra las dos opiniones, el aviso de revisar y el ABCDE', (tester) async {
    await mostrar(tester, resultado(revisar: true));
    expect(find.textContaining('la segunda opinión discrepa'), findsOneWidget);
    expect(find.textContaining('Los dos modelos no coinciden'), findsOneWidget);
    expect(find.text('14.1%'), findsOneWidget);
    expect(find.text('42.1%'), findsOneWidget);
    expect(find.textContaining('umbral 20.8%'), findsOneWidget);
    expect(find.text('Edad: 66'), findsOneWidget);
    expect(find.text('Sexo: femenino'), findsOneWidget);
    expect(find.text('Sitio: Espalda'), findsOneWidget);
    expect(find.text('+3.2 pts'), findsOneWidget);
    expect(find.text('−0.4 pts'), findsOneWidget);
    expect(find.text('sin escala: indique el ancho de la foto'), findsOneWidget);
    expect(find.text('semillas: 10.0% a 20.0%'), findsOneWidget);
    expect(find.text('semillas: 20.0% a 61.0%'), findsOneWidget);
    // Solo QResNet tiene semillas a ambos lados de su umbral.
    expect(find.textContaining('las semillas no coinciden'), findsOneWidget);
    expect(find.text('2 de 6 (marrón claro, blanco)'), findsOneWidget);
    expect(find.byType(Image), findsNWidgets(3));
  });

  testWidgets('sin discrepancia no muestra el aviso; muestra la evolución', (tester) async {
    await mostrar(tester, resultado(revisar: false, evolucion: {'cambio_diametro_pct': 12.5, 'colores_nuevos': []}));
    expect(find.textContaining('Los dos modelos no coinciden'), findsNothing);
    expect(find.textContaining('diámetro +12.5%'), findsOneWidget);
    expect(find.textContaining('comparable solo con el mismo encuadre'), findsOneWidget);
  });

  test('evolución con escala en las dos fotos', () {
    final texto = textoEvolucion({
      'unidad': 'mm', 'cambio_diametro_pct': 25.0, 'diametro_previo': 4.0, 'diametro_actual': 5.0,
      'colores_nuevos': ['azul_gris'],
    });
    expect(texto, 'diámetro +25.0% (4.0 → 5.0 mm), colores nuevos: azul-gris');
  });

  test('alertas clínicas', () {
    expect(alertasClinicas(null, null), isEmpty);
    expect(alertasClinicas({'historial_cancer_previo': true}, {'sintoma_sangrado': true, 'diametro_mm': '6.5'}), [
      'La lesión presenta sangrado.', 'Diámetro mayor de 6 mm.', 'Cáncer previo.',
    ]);
    expect(alertasClinicas({}, {'diametro_mm': ''}), isEmpty);
  });

  test('estiloDecision', () {
    expect(estiloDecision('sospecha')!.texto, 'Sospecha de malignidad');
    expect(estiloDecision('derivar')!.texto, 'Derivar');
    expect(estiloDecision(null), isNull);
  });
}
