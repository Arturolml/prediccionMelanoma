"""
Medicion de los criterios ABCDE sobre la lesion segmentada.

Copia literal de las funciones de 05_analisis/abcde.py del repo de modelos
skin-lesion-classification-rna2026 (fuente de verdad y
documentacion del metodo: v2, normalizacion de escala a 450 px y Shades of
Gray; umbrales fijados en el train de HAM10000 con abcde_validacion.py). La
segmentacion la hace servicio.py con el modelo ya cargado y pasa la mascara a
medir(). La prueba 06_app_ia/pruebas/comparar_con_xai_app.py del repo de
modelos comprueba que los resultados coinciden con los de abcde.py.
"""
import numpy as np
from PIL import Image
from scipy import ndimage

MIN_FRACCION_COLOR = 0.05
LADO_NORMALIZADO = 450
P_SHADES_OF_GRAY = 6
COLORES = ("negro", "marron_oscuro", "marron_claro", "rojo", "azul_gris", "blanco")


def limpiar(m):
    etiquetas, n = ndimage.label(m)
    if n == 0:
        return m
    mayor = 1 + int(np.argmax(ndimage.sum(m, etiquetas, range(1, n + 1))))
    return ndimage.binary_fill_holes(etiquetas == mayor)


def shades_of_gray(rgb, p=P_SHADES_OF_GRAY):
    """Constancia de color: estima el iluminante con la norma p de cada canal y lo lleva a gris neutro."""
    c = rgb.astype(np.float64)
    e = np.power(np.mean(np.power(c, p), axis=(0, 1)), 1.0 / p)
    return np.clip(c * (e.mean() / (e + 1e-9)), 0, 255)


def normalizar_escala(imagen_pil, m):
    """Imagen y mascara a LADO_NORMALIZADO px de lado menor; contorno suavizado. Devuelve (rgb, mascara, factor)."""
    f = LADO_NORMALIZADO / min(imagen_pil.size)
    tam = (max(1, round(imagen_pil.size[0] * f)), max(1, round(imagen_pil.size[1] * f)))
    rgb = np.asarray(imagen_pil.convert("RGB").resize(tam, Image.LANCZOS))
    mf = np.asarray(Image.fromarray(m.astype(np.uint8) * 255).resize(tam, Image.BILINEAR)).astype(np.float64) / 255
    mf = ndimage.gaussian_filter(mf, sigma=2.0)
    return rgb, limpiar(mf > 0.5), f


def rgb_a_lab(rgb):
    """RGB (0-255) -> CIELAB (D65)."""
    c = rgb.astype(np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]).T
    xyz /= np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def asimetria(m, lab):
    ys, xs = np.nonzero(m)
    cy, cx = ys.mean(), xs.mean()
    coords = np.stack([ys - cy, xs - cx], 1)
    _, vecs = np.linalg.eigh(np.cov(coords.T))
    area = len(ys)
    ejes = []
    for k in (1, 0):  # eje mayor y eje menor
        v = vecs[:, k]
        normal = np.array([-v[1], v[0]])
        dist = coords @ normal
        refl = coords - 2 * dist[:, None] * normal[None, :]
        ry, rx = np.round(refl[:, 0] + cy).astype(int), np.round(refl[:, 1] + cx).astype(int)
        dentro = (ry >= 0) & (ry < m.shape[0]) & (rx >= 0) & (rx < m.shape[1])
        coincide = np.zeros(area, bool)
        coincide[dentro] = m[ry[dentro], rx[dentro]]
        forma = float(1 - coincide.mean())
        lado = dist > 0
        de = float(np.linalg.norm(lab[ys[lado], xs[lado]].mean(0) - lab[ys[~lado], xs[~lado]].mean(0))) if lado.any() and (~lado).any() else 0.0
        ejes.append({"forma": forma, "color_delta_e": de})
    return ejes, (cy, cx)


def borde(m, lab, centro):
    area = m.sum()
    contorno = m & ~ndimage.binary_erosion(m)
    perimetro = float(contorno.sum())
    irregularidad = float(perimetro ** 2 / (4 * np.pi * area))
    L = lab[..., 0]
    ancho = max(2, int(round(0.03 * np.sqrt(area))))
    interior = m & ~ndimage.binary_erosion(m, iterations=ancho)
    exterior = ndimage.binary_dilation(m, iterations=ancho) & ~m
    contraste = abs(L[m].mean() - L[~m].mean()) + 1e-6 if (~m).any() else 1.0
    cy, cx = centro
    yy, xx = np.mgrid[0:m.shape[0], 0:m.shape[1]]
    sector = (((np.arctan2(yy - cy, xx - cx) + np.pi) / (2 * np.pi) * 8).astype(int)) % 8
    saltos = []
    for s in range(8):
        i, e = interior & (sector == s), exterior & (sector == s)
        saltos.append(float(abs(L[i].mean() - L[e].mean()) / contraste) if i.any() and e.any() else 0.0)
    return irregularidad, saltos


def colores(m, lab):
    L, a, b = lab[m][:, 0], lab[m][:, 1], lab[m][:, 2]
    croma = np.hypot(a, b)
    # Reglas sobre colores con Shades of Gray. Respecto de las reglas sin normalizar
    # (v1), a* y b* se corrieron por el desplazamiento medio que produce la
    # normalizacion en lesiones del train de HAM10000 (a* -15, b* -4, croma menor).
    reglas = {
        "negro": L < 22,
        "azul_gris": (L >= 22) & (L < 70) & (b < 0) & (croma < 14),
        "blanco": (L >= 78) & (croma < 12),
        "rojo": (L >= 22) & (a > 12) & (a > 1.3 * b),
        "marron_oscuro": (L >= 22) & (L < 45) & (b >= 0),
        "marron_claro": (L >= 45) & (L < 78) & (b >= 0),
    }
    usados = np.zeros(len(L), bool)
    fr = {}
    for c in ("negro", "azul_gris", "blanco", "rojo", "marron_oscuro", "marron_claro"):  # orden de prioridad
        sel = reglas[c] & ~usados
        usados |= sel
        fr[c] = float(sel.mean())
    return {c: fr[c] for c in COLORES}


def diametro_feret(m):
    ys, xs = np.nonzero(m & ~ndimage.binary_erosion(m))
    pts = np.stack([ys, xs], 1).astype(np.float64)
    if len(pts) > 1500:
        pts = pts[np.linspace(0, len(pts) - 1, 1500).astype(int)]
    d = np.sqrt(((pts[:, None, :] - pts[None, :, :]) ** 2).sum(-1))
    return float(d.max())


def medir(imagen_pil, mascara):
    """Medidas crudas de ABCDE (sin umbrales) para una imagen y la mascara de su lesion."""
    m0 = limpiar(mascara)
    if m0.sum() < 50:
        return {"error": "no se encontro lesion"}
    img, m, factor = normalizar_escala(imagen_pil, m0)
    if m.sum() < 50:
        return {"error": "no se encontro lesion"}
    lab = rgb_a_lab(shades_of_gray(img))
    ejes, centro = asimetria(m, lab)
    irregularidad, saltos = borde(m, lab, centro)
    fr = colores(m, lab)
    feret = diametro_feret(m)
    toca_bordes = bool(m[0].any() or m[-1].any() or m[:, 0].any() or m[:, -1].any())
    return {"area_px": int(m0.sum()), "fraccion_imagen": float(m.mean()), "lesion_toca_borde_de_la_foto": toca_bordes,
            "A_ejes": ejes, "B_irregularidad": irregularidad, "B_saltos_por_sector": saltos,
            "C_fracciones": fr, "D_feret_px": feret / factor, "D_relativo": feret / min(m.shape), "_mascara": m0}


def puntuar(med, umbrales, px_por_mm=None):
    """Aplica los umbrales (fijados en train) y arma el informe legible."""
    if "error" in med:
        return med
    u = umbrales
    ejes_asim = [e["forma"] > u["A_forma"] or e["color_delta_e"] > u["A_color_delta_e"] for e in med["A_ejes"]]
    abruptos = sum(s > u["B_salto"] for s in med["B_saltos_por_sector"])
    presentes = [c for c in COLORES if med["C_fracciones"][c] >= MIN_FRACCION_COLOR]
    d = {"px": round(med["D_feret_px"], 1), "relativo_al_lado_menor": round(med["D_relativo"], 3)}
    if px_por_mm:
        mm = med["D_feret_px"] / px_por_mm
        d.update({"mm": round(mm, 2), "mayor_6_mm": bool(mm > 6)})
    else:
        d["mm"] = None
        d["nota"] = "sin escala: indicar px por mm (regla en la foto o calibracion del dermatoscopio) para informar mm y > 6 mm"
    inf = {
        "A_asimetria": {"ejes_asimetricos": int(sum(ejes_asim)), "de": 2, "asimetrica": bool(sum(ejes_asim) >= 1),
                        "detalle": [{k: round(v, 3) for k, v in e.items()} for e in med["A_ejes"]]},
        "B_borde": {"indice_irregularidad": round(med["B_irregularidad"], 3), "irregular": bool(med["B_irregularidad"] > u["B_irregularidad"]),
                    "sectores_con_corte_abrupto": int(abruptos), "de": 8},
        "C_color": {"n_colores": len(presentes), "de": 6, "colores": presentes, "multicolor": len(presentes) >= u["C_n_colores"],
                    "fracciones": {c: round(v, 3) for c, v in med["C_fracciones"].items()}},
        "D_diametro": d,
        "E_evolucion": {"nota": "requiere una imagen previa de la misma lesion (--previa)"},
        "advertencias": (["la lesion toca el borde de la foto: forma, borde y diametro pueden estar incompletos"]
                         if med["lesion_toca_borde_de_la_foto"] else []),
    }
    return inf


def evolucion(med_prev, med_act, px_por_mm_prev=None, px_por_mm_act=None):
    """Cambios entre dos fotos de la misma lesion (solo comparables si tienen la misma escala o se dan las dos)."""
    if px_por_mm_prev and px_por_mm_act:
        d0, d1 = med_prev["D_feret_px"] / px_por_mm_prev, med_act["D_feret_px"] / px_por_mm_act
        unidad = "mm"
    else:
        d0, d1 = med_prev["D_relativo"], med_act["D_relativo"]
        unidad = "relativo (comparable solo con el mismo encuadre y aumento)"
    return {"diametro_previo": round(d0, 3), "diametro_actual": round(d1, 3), "unidad": unidad,
            "cambio_diametro_pct": round(100 * (d1 - d0) / max(d0, 1e-9), 1),
            "cambio_asimetria_forma_eje_mayor": round(med_act["A_ejes"][0]["forma"] - med_prev["A_ejes"][0]["forma"], 3),
            "colores_nuevos": [c for c in COLORES if med_act["C_fracciones"][c] >= MIN_FRACCION_COLOR > med_prev["C_fracciones"][c]]}
