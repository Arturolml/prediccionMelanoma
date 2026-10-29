"""
API de IA de la app de melanoma (Fase 14).

Modelos, umbrales y explicacion: ver servicio_ia/servicio.py. Los pesos no van
en la imagen de Docker: se montan en ARTEFACTOS_DIR (carpeta generada por
exportar_artefactos.py del repo de modelos, con manifiesto de hashes que se
verifica al arrancar).

Endpoints:
- GET  /health          estado del servicio y version de los modelos
- POST /api/v2/predict  imagen + edad, sexo, sitio (y opcionales); respuesta
                        completa: dos opiniones, decision, explicacion, ABCDE
- POST /api/v1/predict  formato anterior (solo imagen), calculado con los
                        modelos nuevos; solo para la transicion del backend

Variables de entorno:
- ARTEFACTOS_DIR   carpeta de artefactos (por defecto /app/artefactos)
- IA_DEVICE        cpu (por defecto) o cuda
- IA_HILOS         hilos de PyTorch en CPU (por defecto, los que decida PyTorch)
- IA_MAX_IMAGEN_MB tamano maximo de cada imagen subida (por defecto 20)
"""

import io
import logging
import math
import os
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
import torch
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError

from servicio_ia import ErrorEntrada, ServicioIA

ARTEFACTOS_DIR = os.environ.get("ARTEFACTOS_DIR", "/app/artefactos")
IA_DEVICE = os.environ.get("IA_DEVICE", "cpu")
IA_HILOS = os.environ.get("IA_HILOS")
MAX_BYTES = int(float(os.environ.get("IA_MAX_IMAGEN_MB", "20")) * 1024 * 1024)
Image.MAX_IMAGE_PIXELS = 60_000_000  # rechaza imagenes desmesuradas (bomba de descompresion)

log = logging.getLogger("uvicorn.error")
estado = {"servicio": None, "error": None}


@asynccontextmanager
async def lifespan(_app):
    if IA_HILOS:
        torch.set_num_threads(int(IA_HILOS))
    try:
        log.info("Cargando modelos desde %s (%s)...", ARTEFACTOS_DIR, IA_DEVICE)
        estado["servicio"] = ServicioIA(ARTEFACTOS_DIR, device=IA_DEVICE)
        log.info("Modelos cargados: %s", estado["servicio"].version_modelos)
    except Exception as e:  # el servicio queda arriba respondiendo 503, con el motivo en /health
        estado["error"] = f"{type(e).__name__}: {e}"
        log.exception("No se pudieron cargar los modelos")
    yield


app = FastAPI(
    title="Melanoma IA API",
    description="Inferencia y explicabilidad para la deteccion de melanoma (Fase 14: Fusion + QResNet-Hybrid)",
    version="2.0.0",
    root_path="/apiiaprediccion",
    lifespan=lifespan,
)


def _error(status, mensaje):
    return JSONResponse(status_code=status, content={"error": mensaje})


def _a_json(x):
    """Convierte tipos de numpy a tipos de Python para serializar la respuesta."""
    if isinstance(x, dict):
        return {k: _a_json(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_a_json(v) for v in x]
    if isinstance(x, np.generic):
        x = x.item()
    if isinstance(x, float) and not math.isfinite(x):
        return None
    return x


def _leer_imagen(archivo: UploadFile, nombre: str):
    """Lee la imagen en memoria (sin archivos temporales) y la valida."""
    datos = archivo.file.read(MAX_BYTES + 1)
    if not datos:
        raise ErrorEntrada(f"{nombre}: archivo vacío")
    if len(datos) > MAX_BYTES:
        raise ErrorEntrada(f"{nombre}: supera el tamaño máximo de {MAX_BYTES // (1024 * 1024)} MB")
    try:
        imagen = Image.open(io.BytesIO(datos))
        imagen.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise ErrorEntrada(f"{nombre}: no es una imagen válida (JPEG, PNG o WEBP)") from None
    if imagen.format not in ("JPEG", "PNG", "WEBP"):
        raise ErrorEntrada(f"{nombre}: formato {imagen.format} no admitido (JPEG, PNG o WEBP)")
    return imagen


def _predecir(**kw):
    """Ejecuta la prediccion; devuelve (resultado, None) o (None, respuesta de error)."""
    servicio = estado["servicio"]
    if servicio is None:
        return None, _error(503, "Servicio de IA no disponible: los modelos no están cargados")
    try:
        res = servicio.predecir(**kw)
    except ErrorEntrada as e:
        return None, _error(400, str(e))
    except Exception:
        log.exception("Error al analizar la imagen")
        return None, _error(500, "Error interno al analizar la imagen")
    res.pop("_mapas", None)
    return _a_json(res), None


@app.get("/health")
def health():
    s = estado["servicio"]
    if s is None:
        return JSONResponse(status_code=503, content={"estado": "sin_modelos", "error": estado["error"]})
    return {"estado": "ok", "version_modelos": s.version_modelos, "device": str(s.device),
            "politica_por_defecto": s.politica_por_defecto, "politicas": list(s.politicas),
            "umbrales": {"fusion": s.umbral_fusion, "qresnet": s.umbral_qresnet}, "sitios": list(s.sitios)}


# Los endpoints de prediccion son funciones normales (no async): FastAPI las
# corre en su pool de hilos y el calculo no bloquea /health.
@app.post("/api/v2/predict")
def predict_v2(
    image: UploadFile = File(...),
    edad: Optional[str] = Form(None),
    sexo: Optional[str] = Form(None),
    sitio: Optional[str] = Form(None),
    politica: Optional[str] = Form(None),
    px_por_mm: Optional[str] = Form(None),
    imagen_previa: Optional[UploadFile] = File(None),
    px_por_mm_previa: Optional[str] = Form(None),
):
    try:
        img = _leer_imagen(image, "image")
        previa = _leer_imagen(imagen_previa, "imagen_previa") if imagen_previa is not None else None
    except ErrorEntrada as e:
        return _error(400, str(e))
    res, err = _predecir(imagen=img, edad=edad, sexo=sexo, sitio=sitio, politica=politica, px_por_mm=px_por_mm,
                         imagen_previa=previa, px_por_mm_previa=px_por_mm_previa)
    return err or res


@app.post("/api/v1/predict")
def predict_v1(image: UploadFile = File(...)):
    """Formato anterior para el backend actual, mientras migra a v2.

    Sin metadatos: Fusion recibe edad, sexo y sitio desconocidos. No se
    devuelve morphology_metrics (el backend actual lo convertia en ABCDE con
    reglas no validadas); el ABCDE validado esta en v2.
    """
    try:
        img = _leer_imagen(image, "image")
    except ErrorEntrada as e:
        return _error(400, str(e))
    res, err = _predecir(imagen=img, incluir_imagenes=False)
    if err:
        return err
    f, q = res["fusion"], res["qresnet"]
    sospecha = res["decision"] in ("sospecha", "derivar")
    bloques = {
        "resultado_modelo": (
            "Resultado del modelo:\n"
            f"- Probabilidad de malignidad (Fusión, opinión principal): {f['prob_maligno']:.3f} (umbral {f['umbral']:.3f})\n"
            f"- Segunda opinión (QResNet): {q['prob_maligno']:.3f} (umbral {q['umbral']:.3f})\n"
            f"- {res['mensaje']}\n"
            "- Calculado sin edad, sexo ni sitio anatómico; para usarlos, el backend debe llamar a /api/v2/predict"),
        "advertencia_uso_clinico": "Advertencia y uso clínico:\n- " + res["advertencia_uso_clinico"],
    }
    return {
        "version_modelos": res["version_modelos"],
        "p_malignant": f["prob_maligno"],
        "threshold": f["umbral"],
        "decision_mode": res["politica"],
        "predicted_class": "malignant" if sospecha else "benign",
        "clinical_decision_text": "sospechosa de malignidad" if sospecha else "probablemente benigna",
        "revisar_caso": res["revisar_caso"],
        "text_blocks": bloques,
        "text_explanation": "\n\n".join(bloques.values()),
    }
