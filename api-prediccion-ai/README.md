# API de IA (Fase 14)

Servicio FastAPI que analiza una foto dermatoscópica con dos modelos y explica
el resultado. Reemplaza al modelo Keras anterior.

- **Fusión** (opinión principal): imagen + edad, sexo y sitio anatómico.
- **QResNet-Hybrid** (segunda opinión): solo imagen.
- Cada uno es un ensamble de 3 semillas con su umbral de cribado
  (sensibilidad ≥ 0.90 en validación). Validados en dos hospitales externos.
- Explicación: mapas Grad-CAM de los dos modelos, aporte de cada metadato a la
  probabilidad de Fusión (valores de Shapley) y criterios ABCDE medidos sobre
  la lesión segmentada.

Los modelos se entrenan y validan en el repo
[skin-lesion-classification-rna2026](https://github.com/XAMANEKR/skin-lesion-classification-rna2026)
(`PLAN_INTEGRACION_APP.md`).

## Despliegue

Los pesos (~765 MB) no van en git ni en la imagen de Docker. Se copian al
servidor y se montan como volumen de solo lectura:

```
artefactos_ia/fase14-2026-10-26/     <- junto a docker-compose.yml
  manifiesto.json  config_app.json  umbrales_abcde.json  fondo_shapley.json
  fusion/s42 s123 s999/   qresnet/s42 s123 s999/   segmentacion/
```

Al arrancar, el servicio comprueba cada archivo contra el SHA-256 de
`manifiesto.json`. Si falta alguno o no coincide, la API queda arriba pero
responde 503, y `/health` dice qué falló.

```
docker compose up -d --build api_ia
curl http://localhost:8001/health
```

- Memoria: ~2 GB con los modelos cargados.
- Tiempo: ~2 s por imagen en CPU (16 núcleos), incluida la explicación.
- Las predicciones se atienden de a una; las demás esperan en cola.

Variables de entorno: `ARTEFACTOS_DIR` (por defecto `/app/artefactos`),
`IA_DEVICE` (`cpu` o `cuda`), `IA_HILOS` (hilos de CPU de PyTorch) e
`IA_MAX_IMAGEN_MB` (por defecto 20).

## Endpoints

### `GET /health`

200 con la versión de los modelos, umbrales, políticas y la lista de sitios
válidos, o 503 si los modelos no cargaron.

### `POST /api/v2/predict` (multipart/form-data)

| Campo | Obligatorio | Valores |
|---|---|---|
| `image` | sí | JPEG, PNG o WEBP, máx. 20 MB |
| `edad` | no | entero 0-120; sin dato, Fusión usa la edad media de entrenamiento |
| `sexo` | no | `male`, `female`, `unknown` (por defecto) |
| `sitio` | no | uno de los 16 de abajo; por defecto `unknown` |
| `politica` | no | `consulta` (por defecto) o `cribado` |
| `px_por_mm` | no | escala de la foto; sin ella no se informa el diámetro en mm |
| `imagen_previa` | no | foto anterior de la misma lesión, para el criterio E |
| `px_por_mm_previa` | no | escala de la foto anterior |

Desde el backend: sexo `M` → `male`, `F` → `female`, `Otro` → `unknown`; edad
en años cumplidos a la fecha de la evaluación.

Sitios (`sitio`):

| Valor | Etiqueta sugerida |
|---|---|
| `abdomen` | Abdomen |
| `acral` | Palma o planta (acral) |
| `back` | Espalda |
| `chest` | Pecho |
| `ear` | Oreja |
| `face` | Cara |
| `foot` | Pie |
| `genital` | Genital |
| `hand` | Mano |
| `head/neck` | Cabeza y cuello |
| `lower extremity` | Pierna (extremidad inferior) |
| `neck` | Cuello |
| `scalp` | Cuero cabelludo |
| `trunk` | Tronco (sin especificar) |
| `upper extremity` | Brazo (extremidad superior) |
| `unknown` | No especificado |

Respuesta 200 (resumida):

```json
{
  "version_modelos": "fase14-2026-10-26",
  "p_malignant": 0.107,
  "politica": "consulta",
  "decision": "sin_sospecha",
  "revisar_caso": true,
  "coinciden": false,
  "mensaje": "Sin sospecha de malignidad — la segunda opinión discrepa: revisar el caso",
  "metadatos_usados": {"edad": "65", "sexo": "male", "sitio": "back"},
  "fusion": {"prob_maligno": 0.107, "prob_por_semilla": [0.05, 0.13, 0.14], "umbral": 0.2079, "sospecha": false,
             "prob_sin_metadatos": 0.106, "aporte_total_metadatos": 0.001,
             "aporte_metadatos": {"edad": 0.028, "sexo": -0.007, "sitio": -0.020}},
  "qresnet": {"prob_maligno": 0.421, "prob_por_semilla": [0.24, 0.83, 0.19], "umbral": 0.2263, "sospecha": true},
  "abcde": {"asimetria": false, "bordes_irregulares": false, "color_variable": false, "n_colores": 2,
            "colores": ["marron_claro", "blanco"], "diametro_mm": null, "diametro_mayor_6_mm": null,
            "evolucion": null, "advertencias": ["sin escala: el diámetro no se informa en mm"], "detalle": {}},
  "imagenes": {"mapa_fusion_png": "<base64>", "mapa_qresnet_png": "<base64>", "contorno_lesion_png": "<base64>"},
  "advertencia_uso_clinico": "Herramienta de apoyo a la decisión; no sustituye la evaluación dermatológica.",
  "tiempo_s": 1.22
}
```

- **`decision`** es lo que la app debe mostrar y usar para colorear:
  - con `consulta`: `sospecha` o `sin_sospecha`;
  - con `cribado`: `derivar` o `sin_sospecha`.

  No uses cortes fijos sobre la probabilidad: el umbral de Fusión es 0.208, así
  que un 35 % ya es sospecha.
- **`revisar_caso`** (solo con `consulta`) es verdadero cuando QResNet no
  coincide con Fusión. En esos casos la exactitud cae al 56-68 %, por eso se
  pide revisión.
- **`p_malignant`** es la probabilidad de Fusión. Se mantiene por
  compatibilidad.
- **`aporte_metadatos`**: puntos de probabilidad que suma (positivo) o resta
  (negativo) cada dato del paciente, comparado con un paciente cualquiera.
- **`abcde`**:
  - `detalle` trae las medidas completas;
  - si no se encuentra la lesión, viene `error` y los criterios en `null`;
  - `evolucion` solo viene si se manda `imagen_previa`;
  - el diámetro en mm solo viene si se manda `px_por_mm`.
- **`imagenes`**:
  - mapas: superpuestos sobre el recorte central que ven los modelos, de
    384 × 384 px;
  - contorno: sobre la foto completa, con lado mayor de 768 px.

  Las tres imágenes suman ~650 KB por respuesta.

Errores:

| Código | Cuándo | Cuerpo |
|---|---|---|
| 400 | dato o imagen inválidos | `{"error": "<mensaje en español>"}` |
| 422 | falta `image` | formato estándar de FastAPI |
| 503 | modelos no cargados | `{"error": "..."}` |
| 500 | error interno | mensaje genérico; el detalle queda en el log |

### `POST /api/v1/predict` (transición)

Mantiene el formato anterior (`p_malignant`, `threshold`, `predicted_class`,
`text_explanation`...) para que el backend actual siga funcionando mientras
migra a v2. Se calcula con los modelos nuevos, pero sin edad, sexo ni sitio.

Ya no devuelve `morphology_metrics`: el backend lo convertía en ABCDE con
reglas no validadas. El ABCDE validado está en v2. Este endpoint se retirará
cuando el backend use v2.
