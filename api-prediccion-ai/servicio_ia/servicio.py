"""
Servicio de inferencia de la app (Fase 14): dos opiniones, explicacion y ABCDE.

1. Fusion 384 + cabeza auxiliar + ISIC 2019 (opinion principal): imagen +
   edad, sexo y sitio anatomico. Ensamble de 3 semillas.
2. QResNet-Hybrid archive_limpio + ISIC 2019 (segunda opinion): solo imagen.
   Ensamble de 3 semillas.

Cada ensamble promedia las probabilidades calibradas (temperatura por
semilla) y decide con su umbral de cribado (config_app.json: sensibilidad
>= 0.90 en validation). Politicas: "consulta" (decide Fusion; si QResNet
discrepa se indica revisar el caso) y "cribado" (se deriva si cualquiera de
los dos supera su umbral).

Explicacion:
- Grad-CAM de backbone.layer4 de la clase predicha, promedio de las 3
  semillas (cada mapa normalizado a [0, 1]), para los dos modelos.
- Valores de Shapley exactos de edad, sexo y sitio sobre la probabilidad de
  Fusion, con un fondo fijo de 100 pacientes del train.
- ABCDE medido sobre la lesion segmentada (DeepLabV3), con los umbrales
  fijados en el train de HAM10000.

Cada red se evalua una sola vez por semilla: del mismo paso salen la
probabilidad, el Grad-CAM (el de la clase contraria es el mismo mapa con el
signo invertido antes del ReLU) y el embedding de imagen que reusa Shapley.

Los artefactos (pesos y configuracion) los genera exportar_artefactos.py del
repo de modelos (skin-lesion-classification-rna2026, carpeta 06_app_ia) con
un manifiesto de hashes; ver ServicioIA.
"""

import base64
import hashlib
import io
import itertools
import json
import math
import os
import threading
import time

import numpy as np
import torch
from PIL import Image
from scipy import ndimage
from torchvision import transforms

from . import abcde_medicion as abcde
from .arquitecturas import (
    MEDIA_IMAGENET, STD_IMAGENET, ImageMetadataFusionModel, MetadataEncoder, QuaternionResNetHybrid,
    preparar_imagen_segmentacion, segmentador,
)

VARIABLES = ("age", "sex", "localization")
NOMBRE_VARIABLE = {"age": "edad", "sex": "sexo", "localization": "sitio"}
SEXOS = ("male", "female", "unknown")
EDAD_MAXIMA = 120
LADO_MAPA = 384             # lado de las imagenes de los mapas en la respuesta
LADO_MAX_CONTORNO = 768     # lado mayor de la imagen con el contorno de la lesion
ALFA_MAPA = 0.45
COLOR_CONTORNO = (0, 229, 255)
ADVERTENCIA_CLINICA = "Herramienta de apoyo a la decisión; no sustituye la evaluación dermatológica."


class ErrorEntrada(ValueError):
    """Dato de entrada invalido (la API lo devuelve como 400)."""


class ErrorArtefactos(RuntimeError):
    """Faltan artefactos o no coinciden con el manifiesto."""


def _sha256(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def _transformacion(lado):
    """Igual que la evaluacion de entrenamiento: redimensionar a 1.12x y recorte central."""
    return transforms.Compose([transforms.Resize(int(lado * 1.12)), transforms.CenterCrop(lado),
                               transforms.ToTensor(), transforms.Normalize(MEDIA_IMAGENET, STD_IMAGENET)])


def _paso_gradcam(capa, forward):
    """Un paso hacia adelante con Grad-CAM de `capa`.

    Devuelve (logits, mapa_crudo, extra): mapa_crudo es sum_c w_c A_c sin ReLU
    para el puntaje logit maligno - logit benigno; el mapa de la clase benigna
    es relu(-mapa_crudo).
    """
    act = {}
    gancho = capa.register_forward_hook(lambda _m, _i, o: act.__setitem__("a", o))
    try:
        logits, extra = forward()
    finally:
        gancho.remove()
    grad = torch.autograd.grad(logits[0, 1] - logits[0, 0], act["a"])[0][0]
    crudo = (grad.mean(dim=(1, 2))[:, None, None] * act["a"][0]).sum(0).detach().cpu().numpy()
    return logits.detach(), crudo, extra


def _mapa_clase(crudos, sospecha):
    """Promedio de los mapas de la clase predicha, cada uno normalizado a [0, 1]."""
    mapas = []
    for c in crudos:
        m = np.maximum(c if sospecha else -c, 0)
        mapas.append(m / m.max() if m.max() > 0 else m)
    return np.mean(mapas, axis=0)


def _jet(x):
    """Mapa de color 'jet' para valores en [0, 1] -> RGB en [0, 1]."""
    return np.clip(np.stack([1.5 - np.abs(4 * x - 3), 1.5 - np.abs(4 * x - 2), 1.5 - np.abs(4 * x - 1)], -1), 0, 1)


def _png_base64(rgb_u8):
    buf = io.BytesIO()
    Image.fromarray(rgb_u8).save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _recorte_modelos(imagen):
    """El recorte central que ven los dos modelos (1/1.12 del lado menor), a LADO_MAPA px."""
    lado = min(imagen.size) / 1.12
    izq, arr = (imagen.size[0] - lado) / 2, (imagen.size[1] - lado) / 2
    return np.asarray(imagen.crop((izq, arr, izq + lado, arr + lado)).resize((LADO_MAPA, LADO_MAPA), Image.BILINEAR)) / 255.0


def _superponer(recorte, mapa):
    m = np.asarray(Image.fromarray((mapa * 255).astype(np.uint8)).resize((LADO_MAPA, LADO_MAPA), Image.BILINEAR)) / 255.0
    return ((1 - ALFA_MAPA) * recorte + ALFA_MAPA * _jet(m)) * 255


def _contorno(imagen, mascara):
    f = min(1.0, LADO_MAX_CONTORNO / max(imagen.size))
    tam = (max(1, round(imagen.size[0] * f)), max(1, round(imagen.size[1] * f)))
    rgb = np.asarray(imagen.resize(tam, Image.BILINEAR)).copy()
    m = np.asarray(Image.fromarray(mascara.astype(np.uint8) * 255).resize(tam, Image.NEAREST)) > 127
    borde = ndimage.binary_dilation(m & ~ndimage.binary_erosion(m), iterations=1)
    rgb[borde] = COLOR_CONTORNO
    return rgb


class ServicioIA:
    """Carga los modelos una vez y atiende predicciones (una a la vez: los
    modelos comparten memoria y las peticiones se serializan con un candado).

    dir_artefactos contiene manifiesto.json, config_app.json,
    umbrales_abcde.json, fondo_shapley.json y las carpetas fusion/, qresnet/ y
    segmentacion/ que escribe exportar_artefactos.py.
    """

    def __init__(self, dir_artefactos, device="cpu", verificar_hashes=True):
        self.dir = dir_artefactos
        self.device = torch.device(device)
        self._candado = threading.Lock()
        self.manifiesto = self._json("manifiesto.json")
        if verificar_hashes:
            self._verificar()
        self.version_modelos = self.manifiesto["version_modelos"]
        cfg = self._json("config_app.json")
        self.umbral_fusion = float(cfg["umbrales"]["fusion"])
        self.umbral_qresnet = float(cfg["umbrales"]["qresnet"])
        self.politicas = tuple(cfg["politicas"])
        self.politica_por_defecto = cfg["politica_por_defecto"]
        self.umbrales_abcde = self._json("umbrales_abcde.json")["umbrales"]
        self.fondo = self._json("fondo_shapley.json")["filas"]
        self.fusion = [self._cargar_fusion(s) for s in self.manifiesto["modelos"]["fusion"]]
        self.qresnet = [self._cargar_qresnet(s) for s in self.manifiesto["modelos"]["qresnet"]]
        self.segmentador = segmentador().to(self.device).eval()
        self.segmentador.load_state_dict(self._pesos(self.manifiesto["modelos"]["segmentacion"])["model_state"])
        self.sitios = tuple(self.fusion[0]["encoder"].loc_categories)

    # ---------------------------------------------------------------- carga
    def _ruta(self, rel):
        return os.path.join(self.dir, rel)

    def _json(self, rel):
        with open(self._ruta(rel), encoding="utf-8") as f:
            return json.load(f)

    def _pesos(self, rel):
        return torch.load(self._ruta(rel), map_location=self.device, weights_only=True)

    def _verificar(self):
        for rel, info in self.manifiesto["archivos"].items():
            ruta = self._ruta(rel)
            if not os.path.isfile(ruta):
                raise ErrorArtefactos(f"falta el artefacto {rel}")
            if os.path.getsize(ruta) != info["bytes"] or _sha256(ruta) != info["sha256"]:
                raise ErrorArtefactos(f"el artefacto {rel} no coincide con el manifiesto")

    def _cargar_fusion(self, carpeta):
        ck = self._pesos(f"{carpeta}/modelo.pt")
        modelo = ImageMetadataFusionModel(n_meta_features=ck["n_meta_features"], n_aux_classes=ck["n_aux_classes"])
        modelo.load_state_dict(ck["model_state"])
        return {"modelo": modelo.to(self.device).eval(), "temperatura": float(ck["temperatura"]),
                "tf": _transformacion(int(ck["img_size"])),
                "encoder": MetadataEncoder(self._json(f"{carpeta}/metadata_encoder.json"))}

    def _cargar_qresnet(self, carpeta):
        ck = self._pesos(f"{carpeta}/modelo.pt")
        modelo = QuaternionResNetHybrid(q_hidden=int(ck["q_hidden"]))
        modelo.load_state_dict(ck["model_state"])
        return {"modelo": modelo.to(self.device).eval(), "temperatura": float(ck["temperatura"]),
                "tf": _transformacion(int(ck["img_size"]))}

    # ------------------------------------------------------------- entrada
    def normalizar_paciente(self, edad=None, sexo=None, sitio=None):
        """Valida edad, sexo y sitio y los lleva al formato del codificador de Fusion."""
        if edad in (None, ""):
            edad_txt = ""
        else:
            try:
                e = float(edad)
            except (TypeError, ValueError):
                raise ErrorEntrada(f"edad inválida: {edad!r}") from None
            if not (0 <= e <= EDAD_MAXIMA) or not math.isfinite(e):
                raise ErrorEntrada(f"edad fuera de rango (0-{EDAD_MAXIMA}): {edad!r}")
            edad_txt = str(int(e))
        sexo = sexo or "unknown"
        if sexo not in SEXOS:
            raise ErrorEntrada(f"sexo inválido: {sexo!r}; valores: {', '.join(SEXOS)}")
        sitio = sitio or "unknown"
        if sitio not in self.sitios:
            raise ErrorEntrada(f"sitio inválido: {sitio!r}; valores: {', '.join(self.sitios)}")
        return {"age": edad_txt, "sex": sexo, "localization": sitio}

    @staticmethod
    def _px_por_mm(valor, nombre):
        if valor in (None, ""):
            return None
        try:
            v = float(valor)
        except (TypeError, ValueError):
            raise ErrorEntrada(f"{nombre} inválido: {valor!r}") from None
        if not (v > 0 and math.isfinite(v)):
            raise ErrorEntrada(f"{nombre} debe ser un número positivo")
        return v

    # ------------------------------------------------------------- modelos
    def _fusion(self, imagen, paciente):
        crudos, probs, embs = [], [], []
        for m in self.fusion:
            modelo, x = m["modelo"], m["tf"](imagen).unsqueeze(0).to(self.device)
            meta = torch.from_numpy(m["encoder"].encode(paciente)[None]).to(self.device)

            def forward(modelo=modelo, x=x, meta=meta):
                emb = modelo.image_proj(modelo.backbone(x))
                return modelo.clasificar(emb, meta), emb

            logits, crudo, emb = _paso_gradcam(modelo.backbone.layer4, forward)
            crudos.append(crudo)
            probs.append(float(torch.softmax(logits.float() / m["temperatura"], dim=1)[0, 1]))
            embs.append(emb.detach())
        p = float(np.mean(probs))
        phi, base, total = self._shapley(embs, paciente)
        if abs(sum(phi.values()) - (total - base)) > 1e-6 or abs(total - p) > 1e-4:
            raise RuntimeError("Shapley no cumple la propiedad de eficiencia")
        sospecha = p >= self.umbral_fusion
        return {
            "prob_maligno": p, "prob_por_semilla": probs, "umbral": self.umbral_fusion, "sospecha": bool(sospecha),
            "prob_sin_metadatos": base, "aporte_total_metadatos": total - base,
            "aporte_metadatos": {NOMBRE_VARIABLE[v]: phi[v] for v in VARIABLES},
        }, _mapa_clase(crudos, sospecha)

    @torch.no_grad()
    def _prob_fusion_filas(self, m, emb, filas):
        meta = torch.from_numpy(np.stack([m["encoder"].encode(r) for r in filas])).to(self.device)
        logits = m["modelo"].clasificar(emb.expand(len(filas), -1), meta)
        return torch.softmax(logits.float() / m["temperatura"], dim=1)[:, 1].cpu().numpy()

    def _shapley(self, embs, paciente):
        """Shapley exacto de las 3 variables sobre la probabilidad del ensamble de Fusion."""
        v = {}
        for k in range(len(VARIABLES) + 1):
            for S in itertools.combinations(VARIABLES, k):
                filas = [{var: (paciente[var] if var in S else b[var]) for var in VARIABLES} for b in self.fondo]
                v[S] = float(np.mean([self._prob_fusion_filas(m, e, filas).mean() for m, e in zip(self.fusion, embs)]))
        n, phi = len(VARIABLES), {}
        for var in VARIABLES:
            resto = [u for u in VARIABLES if u != var]
            total = 0.0
            for k in range(n):
                for S in itertools.combinations(resto, k):
                    con = tuple(u for u in VARIABLES if u in S or u == var)
                    total += math.factorial(len(S)) * math.factorial(n - len(S) - 1) / math.factorial(n) * (v[con] - v[S])
            phi[var] = total
        return phi, v[()], v[VARIABLES]

    def _qresnet(self, imagen):
        crudos, probs = [], []
        for m in self.qresnet:
            modelo, x = m["modelo"], m["tf"](imagen).unsqueeze(0).to(self.device)
            logits, crudo, _ = _paso_gradcam(modelo.backbone.layer4, lambda modelo=modelo, x=x: (modelo(x), None))
            crudos.append(crudo)
            probs.append(float(torch.softmax(logits.float() / m["temperatura"], dim=1)[0, 1]))
        p = float(np.mean(probs))
        sospecha = p >= self.umbral_qresnet
        return {"prob_maligno": p, "prob_por_semilla": probs, "umbral": self.umbral_qresnet,
                "sospecha": bool(sospecha)}, _mapa_clase(crudos, sospecha)

    @torch.no_grad()
    def _segmentar(self, imagen):
        x = preparar_imagen_segmentacion(imagen).unsqueeze(0).to(self.device)
        logit = self.segmentador(x)["out"][0, 0].float().cpu().numpy()
        m = np.asarray(Image.fromarray((logit > 0).astype(np.uint8) * 255).resize(imagen.size, Image.NEAREST)) > 127
        return abcde.limpiar(m)

    def _abcde(self, imagen, px_por_mm, imagen_previa, px_por_mm_previa):
        mascara = self._segmentar(imagen)
        med = abcde.medir(imagen, mascara)
        if "error" in med:
            return {"error": med["error"], "asimetria": None, "bordes_irregulares": None, "color_variable": None,
                    "n_colores": None, "colores": [], "diametro_mm": None, "diametro_mayor_6_mm": None,
                    "evolucion": None, "advertencias": [med["error"]], "detalle": None}, None
        inf = abcde.puntuar(med, self.umbrales_abcde, px_por_mm)
        evolucion = None
        if imagen_previa is not None:
            med_prev = abcde.medir(imagen_previa, self._segmentar(imagen_previa))
            evolucion = ({"error": "no se encontró la lesión en la imagen previa"} if "error" in med_prev
                         else abcde.evolucion(med_prev, med, px_por_mm_previa, px_por_mm))
            inf["E_evolucion"] = evolucion
        d = inf["D_diametro"]
        advertencias = list(inf["advertencias"])
        if d["mm"] is None:
            advertencias.append("sin escala: el diámetro no se informa en mm")
        return {
            "asimetria": inf["A_asimetria"]["asimetrica"],
            "bordes_irregulares": inf["B_borde"]["irregular"],
            "color_variable": inf["C_color"]["multicolor"],
            "n_colores": inf["C_color"]["n_colores"],
            "colores": inf["C_color"]["colores"],
            "diametro_mm": d["mm"],
            "diametro_mayor_6_mm": d.get("mayor_6_mm"),
            "evolucion": evolucion,
            "advertencias": advertencias,
            "detalle": inf,
        }, med["_mascara"]

    # ------------------------------------------------------------ prediccion
    def predecir(self, imagen, edad=None, sexo=None, sitio=None, politica=None, px_por_mm=None,
                 imagen_previa=None, px_por_mm_previa=None, incluir_imagenes=True):
        """imagen e imagen_previa: PIL.Image. Devuelve el diccionario del contrato de /api/v2/predict."""
        paciente = self.normalizar_paciente(edad, sexo, sitio)
        politica = politica or self.politica_por_defecto
        if politica not in self.politicas:
            raise ErrorEntrada(f"política inválida: {politica!r}; valores: {', '.join(self.politicas)}")
        px_por_mm = self._px_por_mm(px_por_mm, "px_por_mm")
        px_por_mm_previa = self._px_por_mm(px_por_mm_previa, "px_por_mm_previa")
        imagen = imagen.convert("RGB")
        imagen_previa = imagen_previa.convert("RGB") if imagen_previa is not None else None

        t0 = time.perf_counter()
        with self._candado:
            fusion, mapa_f = self._fusion(imagen, paciente)
            qresnet, mapa_q = self._qresnet(imagen)
            abcde_res, mascara = self._abcde(imagen, px_por_mm, imagen_previa, px_por_mm_previa)
        sf, sq = fusion["sospecha"], qresnet["sospecha"]
        coinciden = sf == sq
        if politica == "cribado":
            decision = "derivar" if sf or sq else "sin_sospecha"
            mensaje = ("Derivar: " + ("ambos modelos marcan sospecha" if sf and sq else "uno de los modelos marca sospecha (red de seguridad)")
                       if sf or sq else "Sin sospecha en ninguno de los dos modelos")
            revisar = False
        else:
            decision = "sospecha" if sf else "sin_sospecha"
            mensaje = ("Sospecha de malignidad" if sf else "Sin sospecha de malignidad") + (
                " — ambos modelos coinciden" if coinciden else " — la segunda opinión discrepa: revisar el caso")
            revisar = not coinciden

        res = {
            "version_modelos": self.version_modelos,
            "p_malignant": fusion["prob_maligno"],
            "politica": politica,
            "decision": decision,
            "revisar_caso": bool(revisar),
            "coinciden": bool(coinciden),
            "mensaje": mensaje,
            "metadatos_usados": {"edad": paciente["age"] or None, "sexo": paciente["sex"], "sitio": paciente["localization"]},
            "fusion": fusion,
            "qresnet": qresnet,
            "abcde": abcde_res,
            "advertencia_uso_clinico": ADVERTENCIA_CLINICA,
            "tiempo_s": round(time.perf_counter() - t0, 3),
        }
        if incluir_imagenes:
            recorte = _recorte_modelos(imagen)
            res["imagenes"] = {
                "mapa_fusion_png": _png_base64(_superponer(recorte, mapa_f).astype(np.uint8)),
                "mapa_qresnet_png": _png_base64(_superponer(recorte, mapa_q).astype(np.uint8)),
                "contorno_lesion_png": _png_base64(_contorno(imagen, mascara)) if mascara is not None else None,
            }
        # Mapas crudos para las pruebas (no se serializan en la API).
        res["_mapas"] = {"fusion": mapa_f, "qresnet": mapa_q}
        return res
