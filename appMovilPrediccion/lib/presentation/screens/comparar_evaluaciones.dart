import 'package:flutter/material.dart';
import 'package:flutter_app_1/services/api_service.dart';

enum _ModoComparacion { ladoALado, cortina }

class CompararEvaluacionesScreen extends StatefulWidget {
  final List<Map<String, dynamic>> evaluaciones;

  const CompararEvaluacionesScreen({super.key, required this.evaluaciones});

  // Solo se pueden comparar las evaluaciones que tienen foto
  static List<Map<String, dynamic>> conImagen(
    List<Map<String, dynamic>> evaluaciones,
  ) {
    return evaluaciones
        .where((e) => (e['ruta_imagen'] ?? '').toString().isNotEmpty)
        .toList();
  }

  @override
  State<CompararEvaluacionesScreen> createState() =>
      _CompararEvaluacionesScreenState();
}

class _CompararEvaluacionesScreenState
    extends State<CompararEvaluacionesScreen> {
  // Compartido por las dos fotos para que el zoom y el desplazamiento vayan a la par
  final TransformationController _zoom = TransformationController();

  late final List<Map<String, dynamic>> _opciones;
  late Map<String, dynamic> _antes;
  late Map<String, dynamic> _despues;
  _ModoComparacion _modo = _ModoComparacion.ladoALado;
  double _cortina = 0.5;
  // Reconstruye los selectores para que siempre muestren la selección ya ordenada
  int _versionSelectores = 0;

  @override
  void initState() {
    super.initState();
    // De la más reciente a la más antigua
    _opciones = CompararEvaluacionesScreen.conImagen(widget.evaluaciones)
      ..sort((a, b) => _textoFecha(b).compareTo(_textoFecha(a)));

    // Por defecto, las dos fotos más recientes de la misma lesión
    _despues = _opciones.first;
    _antes = _opciones.skip(1).firstWhere(
      (e) => e['id_lesion'] != null && e['id_lesion'] == _despues['id_lesion'],
      orElse: () => _opciones[1],
    );
  }

  @override
  void dispose() {
    _zoom.dispose();
    super.dispose();
  }

  String _textoFecha(Map<String, dynamic> e) =>
      e['fecha_evaluacion']?.toString() ?? '';

  String _fecha(Map<String, dynamic> e) {
    final fecha = DateTime.tryParse(_textoFecha(e));
    if (fecha == null) return 'Sin fecha';
    final dia = fecha.day.toString().padLeft(2, '0');
    final mes = fecha.month.toString().padLeft(2, '0');
    return '$dia/$mes/${fecha.year}';
  }

  String? _zona(Map<String, dynamic> e) {
    final lesion = e['lesiones'];
    final zona = lesion is Map ? lesion['zona_cuerpo']?.toString() : null;
    return zona == null || zona.isEmpty ? null : zona;
  }

  // Mantiene "Antes" como la foto más antigua, sin importar el orden en que se elijan
  void _seleccionar(Map<String, dynamic> elegida, {required bool esAntes}) {
    var antes = esAntes ? elegida : _antes;
    var despues = esAntes ? _despues : elegida;
    if (identical(antes, despues)) {
      antes = esAntes ? elegida : _despues;
      despues = esAntes ? _antes : elegida;
    }
    if (_textoFecha(antes).compareTo(_textoFecha(despues)) > 0) {
      final temporal = antes;
      antes = despues;
      despues = temporal;
    }
    setState(() {
      _antes = antes;
      _despues = despues;
      _versionSelectores++;
    });
  }

  String? _tiempoTranscurrido() {
    final inicio = DateTime.tryParse(_textoFecha(_antes));
    final fin = DateTime.tryParse(_textoFecha(_despues));
    if (inicio == null || fin == null) return null;
    final dias = DateUtils.dateOnly(fin).difference(DateUtils.dateOnly(inicio));
    return switch (dias.inDays) {
      0 => 'Mismo día',
      1 => '1 día entre las fotos',
      final n => '$n días entre las fotos',
    };
  }

  @override
  Widget build(BuildContext context) {
    final mismaLesion =
        _antes['id_lesion'] != null &&
        _antes['id_lesion'] == _despues['id_lesion'];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Comparar evolución'),
        actions: [
          IconButton(
            icon: const Icon(Icons.zoom_out_map),
            tooltip: 'Restablecer zoom',
            onPressed: () => _zoom.value = Matrix4.identity(),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
            child: Row(
              children: [
                Expanded(child: _selector('Antes', _antes, esAntes: true)),
                const SizedBox(width: 8),
                Expanded(child: _selector('Después', _despues, esAntes: false)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: SegmentedButton<_ModoComparacion>(
              segments: const [
                ButtonSegment(
                  value: _ModoComparacion.ladoALado,
                  icon: Icon(Icons.view_column),
                  label: Text('Lado a lado'),
                ),
                ButtonSegment(
                  value: _ModoComparacion.cortina,
                  icon: Icon(Icons.compare),
                  label: Text('Cortina'),
                ),
              ],
              selected: {_modo},
              onSelectionChanged: (seleccion) =>
                  setState(() => _modo = seleccion.first),
            ),
          ),
          Expanded(
            flex: 3,
            child: Container(
              color: Colors.black,
              child: _modo == _ModoComparacion.ladoALado
                  ? _ladoALado()
                  : _vistaCortina(),
            ),
          ),
          if (_modo == _ModoComparacion.cortina)
            Slider(
              value: _cortina,
              semanticFormatterCallback: (v) =>
                  '${(v * 100).round()}% de la foto de antes',
              onChanged: (v) => setState(() => _cortina = v),
            ),
          Expanded(flex: 2, child: _datos(mismaLesion)),
        ],
      ),
    );
  }

  Widget _selector(
    String titulo,
    Map<String, dynamic> actual, {
    required bool esAntes,
  }) {
    return DropdownButtonFormField<Map<String, dynamic>>(
      key: ValueKey('$titulo-$_versionSelectores'),
      initialValue: actual,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: titulo,
        border: const OutlineInputBorder(),
        isDense: true,
      ),
      items: _opciones.map((e) {
        final zona = _zona(e);
        return DropdownMenuItem(
          value: e,
          child: Text(
            zona == null ? _fecha(e) : '${_fecha(e)} · $zona',
            overflow: TextOverflow.ellipsis,
          ),
        );
      }).toList(),
      onChanged: (elegida) {
        if (elegida != null) _seleccionar(elegida, esAntes: esAntes);
      },
    );
  }

  Widget _ladoALado() {
    return Row(
      children: [
        Expanded(child: _fotoConZoom(_antes, 'Antes')),
        const VerticalDivider(width: 2, thickness: 2, color: Colors.white),
        Expanded(child: _fotoConZoom(_despues, 'Después')),
      ],
    );
  }

  Widget _fotoConZoom(Map<String, dynamic> evaluacion, String titulo) {
    return Stack(
      fit: StackFit.expand,
      children: [
        InteractiveViewer(
          transformationController: _zoom,
          maxScale: 6,
          child: _foto(evaluacion),
        ),
        _etiqueta('$titulo · ${_fecha(evaluacion)}', Alignment.topLeft),
      ],
    );
  }

  Widget _vistaCortina() {
    return LayoutBuilder(
      builder: (context, medidas) {
        return Stack(
          fit: StackFit.expand,
          children: [
            InteractiveViewer(
              transformationController: _zoom,
              maxScale: 6,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  _foto(_despues),
                  ClipRect(
                    clipper: _RecorteCortina(_cortina),
                    child: Container(
                      color: Colors.black,
                      child: _foto(_antes),
                    ),
                  ),
                  Positioned(
                    left: medidas.maxWidth * _cortina - 1,
                    top: 0,
                    bottom: 0,
                    child: const SizedBox(
                      width: 2,
                      child: ColoredBox(color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
            _etiqueta('Antes · ${_fecha(_antes)}', Alignment.topLeft),
            _etiqueta('Después · ${_fecha(_despues)}', Alignment.topRight),
          ],
        );
      },
    );
  }

  Widget _foto(Map<String, dynamic> evaluacion) {
    return Image.network(
      ApiService.urlImagenEvaluacion(evaluacion['id_evaluacion']),
      headers: ApiService().imagenHeaders,
      fit: BoxFit.contain,
      loadingBuilder: (context, child, progreso) {
        if (progreso == null) return child;
        return const Center(child: CircularProgressIndicator());
      },
      errorBuilder: (context, error, stackTrace) => const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.broken_image, size: 40, color: Colors.white70),
            Text(
              'Error al cargar imagen',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white70),
            ),
          ],
        ),
      ),
    );
  }

  Widget _etiqueta(String texto, Alignment posicion) {
    return Align(
      alignment: posicion,
      child: Container(
        margin: const EdgeInsets.all(4),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: Colors.black54,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          texto,
          style: const TextStyle(color: Colors.white, fontSize: 11),
        ),
      ),
    );
  }

  Widget _datos(bool mismaLesion) {
    final tiempo = _tiempoTranscurrido();
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        if (!mismaLesion) ...[
          Card(
            color: Colors.orange.shade100,
            child: const Padding(
              padding: EdgeInsets.all(10),
              child: Text(
                'Estas fotos están registradas como lesiones distintas. '
                'Verifique que sean la misma lesión antes de compararlas.',
              ),
            ),
          ),
          const SizedBox(height: 8),
        ],
        if (tiempo != null)
          Text(tiempo, style: const TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Table(
          columnWidths: const {0: FlexColumnWidth(2)},
          border: TableBorder(
            horizontalInside: BorderSide(color: Colors.grey.shade300),
          ),
          children: [
            _fila('', 'Antes', 'Después', encabezado: true),
            _fila(
              'Predicción IA',
              _porcentaje(_antes['prediccion_ia']),
              _porcentaje(_despues['prediccion_ia']),
            ),
            _fila(
              'Diámetro',
              _diametro(_antes['diametro_mm']),
              _diametro(_despues['diametro_mm']),
            ),
            _filaSiNo('Asimetría', 'asimetria'),
            _filaSiNo('Borde irregular', 'bordes_irregulares'),
            _filaSiNo('Color variable', 'color_variable'),
          ],
        ),
        const SizedBox(height: 12),
        const Text(
          'Las fotos pueden tener distinta distancia, ángulo y luz: una '
          'diferencia de tamaño o color en pantalla no confirma un cambio '
          'real. Herramienta de apoyo; no sustituye la evaluación '
          'dermatológica.',
          style: TextStyle(fontSize: 12, color: Colors.black54),
        ),
      ],
    );
  }

  TableRow _filaSiNo(String titulo, String campo) {
    String texto(dynamic v) => v == true ? 'Sí' : 'No';
    return _fila(titulo, texto(_antes[campo]), texto(_despues[campo]));
  }

  TableRow _fila(
    String titulo,
    String antes,
    String despues, {
    bool encabezado = false,
  }) {
    final cambio = !encabezado && antes != despues;
    Widget celda(String texto, {bool resaltar = false}) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
      child: Text(
        texto,
        style: TextStyle(
          fontWeight: encabezado || resaltar
              ? FontWeight.bold
              : FontWeight.normal,
        ),
      ),
    );
    return TableRow(
      children: [
        celda(titulo),
        celda(antes),
        celda(despues, resaltar: cambio),
      ],
    );
  }

  // La app guarda 0 cuando el dato no se capturó
  String _porcentaje(dynamic valor) {
    final numero = valor is num ? valor : num.tryParse('$valor');
    if (numero == null || numero == 0) return 'Sin dato';
    return '${numero.toStringAsFixed(1)}%';
  }

  String _diametro(dynamic valor) {
    final numero = valor is num ? valor : num.tryParse('$valor');
    if (numero == null || numero == 0) return 'Sin dato';
    return '${numero.toStringAsFixed(1)} mm';
  }
}

class _RecorteCortina extends CustomClipper<Rect> {
  final double fraccion;

  _RecorteCortina(this.fraccion);

  @override
  Rect getClip(Size size) =>
      Rect.fromLTWH(0, 0, size.width * fraccion, size.height);

  @override
  bool shouldReclip(_RecorteCortina oldClipper) =>
      oldClipper.fraccion != fraccion;
}
