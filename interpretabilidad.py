import argparse
import importlib.util
import json
import os
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import tensorflow as tf
from matplotlib import cm
import matplotlib.pyplot as plt
from tensorflow.keras.applications.resnet50 import preprocess_input

# ============================================================
# CONFIGURACION
# ============================================================
MODEL_PATH = "mejor_modelo_bi_resnet50.keras"
IMG_SIZE = (224, 224)

# Clase positiva (malignant) y negativa (benign)
NEG_CLASS_NAME = "benign"
POS_CLASS_NAME = "malignant"
POSITIVE_INDEX_SOFTMAX = 1

# Umbrales por modo
THRESH_BALANCE = 0.26
THRESH_SCREEN = 0.20
DECISION_MODE = "screening"  # "balance" o "screening"

# Opcional: cargar configuracion desde metrics JSON del modelo
METRICS_JSON_PATH = None

# Explicabilidad
DEFAULT_XAI_MODEL_TYPE = "auto"  # auto | cnn | vit | qcnn


# ============================================================
# Carga de configuracion y modelo
# ============================================================
def load_runtime_config(metrics_json_path: Optional[str] = None) -> Dict[str, Any]:
    config = {
        "neg_class_name": NEG_CLASS_NAME,
        "pos_class_name": POS_CLASS_NAME,
        "thresh_balance": float(THRESH_BALANCE),
        "thresh_screen": float(THRESH_SCREEN),
    }

    if not metrics_json_path:
        return config

    if not os.path.exists(metrics_json_path):
        raise FileNotFoundError(f"No se encontro metrics JSON: {metrics_json_path}")

    with open(metrics_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    classes = data.get("classes", {})
    thr_best = data.get("threshold_best_f1", {})
    thr_screen = data.get("threshold_screening", {})

    config["neg_class_name"] = classes.get("negative", config["neg_class_name"])
    config["pos_class_name"] = classes.get("positive", config["pos_class_name"])
    config["thresh_balance"] = float(thr_best.get("t", config["thresh_balance"]))
    config["thresh_screen"] = float(thr_screen.get("t", config["thresh_screen"]))

    return config


@lru_cache(maxsize=2)
def load_model_cached(model_path: str):
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"No se encontro el modelo: {model_path}")
    model = tf.keras.models.load_model(model_path)
    print(f"Modelo cargado: {model_path}")
    return model


# ============================================================
# Preprocesamiento
# ============================================================
def preprocess_image_for_model(
    image_path: str,
    img_size: Tuple[int, int] = (224, 224),
    mode: str = "resnet50",
):
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"No se encontro la imagen: {image_path}")

    img = tf.keras.utils.load_img(image_path, target_size=img_size)
    img_array = tf.keras.utils.img_to_array(img)

    if mode == "resnet50":
        x = np.expand_dims(img_array, axis=0).astype(np.float32)
        x = preprocess_input(x)
    elif mode == "simple_0_1":
        x = np.expand_dims(img_array.astype(np.float32) / 255.0, axis=0)
    else:
        raise ValueError("mode debe ser 'resnet50' o 'simple_0_1'")

    return x, img_array


# ============================================================
# Inferencia
# ============================================================
def predict_malignancy_probability(model, x, positive_index_softmax: int = 1):
    """
    Devuelve:
      p_malignant (float)
      raw_pred (np.ndarray)
      output_type ('sigmoid' o 'softmax')
    """
    pred = np.array(model.predict(x, verbose=0))

    if pred.ndim == 1 and pred.shape[0] == 1:
        return float(pred[0]), pred, "sigmoid"

    if pred.ndim == 2 and pred.shape[1] == 1:
        return float(pred[0, 0]), pred, "sigmoid"

    if pred.ndim == 2 and pred.shape[1] == 2:
        if positive_index_softmax not in (0, 1):
            raise ValueError("positive_index_softmax debe ser 0 o 1")
        return float(pred[0, positive_index_softmax]), pred, "softmax"

    raise ValueError(f"Salida del modelo no soportada: shape={pred.shape}")


# ============================================================
# Explicacion textual
# ============================================================
def confidence_level(p_malignant: float, threshold: float) -> str:
    distance = abs(p_malignant - threshold)
    if distance < 0.08:
        return "baja"
    if distance < 0.20:
        return "moderada"
    return "alta"


def generate_text_explanation(
    p_malignant: float,
    threshold: float,
    decision_mode: str,
    neg_class_name: str,
    pos_class_name: str,
    visual_summary: Optional[Dict[str, str]] = None,
    morphology_summary: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    pred_positive = p_malignant >= threshold
    predicted_class = pos_class_name if pred_positive else neg_class_name
    conf = confidence_level(p_malignant, threshold)

    decision_text = "sospechosa de malignidad" if pred_positive else "probablemente benigna"

    if visual_summary is None:
        visual_text = "No se genero mapa de atencion para esta consulta."
    else:
        visual_text = (
            f"El mapa de activacion mostro mayor contribucion en la region {visual_summary['region']}. "
            f"La atencion fue {visual_summary['focus']}."
        )

    if morphology_summary is None or "error" in morphology_summary:
        morph_text = "No fue posible calcular metricas morfologicas confiables para esta imagen."
    else:
        morph_text = (
            f"Asimetria H/V: {morphology_summary['asymmetry_horizontal']:.2f}/{morphology_summary['asymmetry_vertical']:.2f}. "
            f"Irregularidad de borde: {morphology_summary['border_irregularity_index']:.2f}. "
            f"Variacion de color (RGB std media): {morphology_summary['color_std_rgb_mean']:.1f}. "
            f"Homogeneidad de textura: {morphology_summary['texture_homogeneity_simple']:.2f}."
        )

    block_resultado = (
        "Resultado del modelo:\n"
        f"- Probabilidad estimada de malignidad: {p_malignant:.3f}\n"
        f"- Umbral de decision ({decision_mode}): {threshold:.2f}\n"
        f"- Clasificacion: {decision_text}\n"
        f"- Confianza relativa al umbral: {conf}"
    )

    block_visual = "Evidencia visual:\n" + f"- {visual_text}"
    block_morf = "Evidencia morfologica cuantificable:\n" + f"- {morph_text}"
    block_warn = (
        "Advertencia y uso clinico:\n"
        "- Este resultado es una herramienta de apoyo a la decision y no sustituye la evaluacion dermatologica."
    )

    explanation = "\n\n".join([block_resultado, block_visual, block_morf, block_warn])

    return {
        "predicted_class": predicted_class,
        "clinical_decision_text": decision_text,
        "p_malignant": float(p_malignant),
        "threshold": float(threshold),
        "decision_mode": decision_mode,
        "confidence_relative_to_threshold": conf,
        "text_blocks": {
            "resultado_modelo": block_resultado,
            "evidencia_visual": block_visual,
            "evidencia_morfologica": block_morf,
            "advertencia_uso_clinico": block_warn,
        },
        "text_explanation": explanation,
    }


# ============================================================
# Paso 2: Explicabilidad visual (saliencia)
# ============================================================
def _normalize_map(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x, dtype=np.float32)
    x = np.maximum(x, 0.0)
    denom = float(x.max() - x.min())
    if denom < 1e-9:
        return np.zeros_like(x, dtype=np.float32)
    return (x - x.min()) / denom


def _resize_heatmap(heatmap: np.ndarray, target_hw: Tuple[int, int]) -> np.ndarray:
    hm = np.asarray(heatmap, dtype=np.float32)
    hm = np.expand_dims(np.expand_dims(hm, axis=0), axis=-1)
    hm = tf.image.resize(hm, target_hw, method="bilinear").numpy()[0, :, :, 0]
    return _normalize_map(hm)


def detect_tf_model_type(model) -> str:
    has_conv = any(isinstance(l, tf.keras.layers.Conv2D) for l in model.layers)
    has_mha = any(isinstance(l, tf.keras.layers.MultiHeadAttention) for l in model.layers)
    if has_conv:
        return "cnn"
    if has_mha:
        return "vit"
    return "unknown"


def _tf_positive_score(pred_tensor: tf.Tensor, positive_index_softmax: int) -> tf.Tensor:
    if pred_tensor.shape.rank == 2 and pred_tensor.shape[-1] == 1:
        return pred_tensor[:, 0]
    if pred_tensor.shape.rank == 1:
        return pred_tensor
    if pred_tensor.shape.rank == 2 and pred_tensor.shape[-1] == 2:
        return pred_tensor[:, positive_index_softmax]
    raise ValueError(f"Salida no soportada para score positivo: shape={pred_tensor.shape}")


def gradcam_for_cnn(model, x, image_hw: Tuple[int, int], positive_index_softmax: int = 1) -> Dict[str, Any]:
    conv_layers = [l for l in model.layers if isinstance(l, tf.keras.layers.Conv2D)]
    if not conv_layers:
        raise ValueError("No hay capas Conv2D para Grad-CAM.")

    last_conv = conv_layers[-1]
    grad_model = tf.keras.Model([model.inputs], [last_conv.output, model.output])

    x_tf = tf.convert_to_tensor(x)
    with tf.GradientTape() as tape:
        conv_out, preds = grad_model(x_tf, training=False)
        pos_score = _tf_positive_score(preds, positive_index_softmax)

    grads = tape.gradient(pos_score, conv_out)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

    conv_map = conv_out[0]
    heatmap = tf.reduce_sum(conv_map * pooled_grads, axis=-1).numpy()
    heatmap = _normalize_map(heatmap)
    heatmap = _resize_heatmap(heatmap, image_hw)

    return {
        "method": "gradcam",
        "layer": last_conv.name,
        "heatmap": heatmap,
    }


def vit_token_saliency_map(model, x, image_hw: Tuple[int, int], positive_index_softmax: int = 1) -> Dict[str, Any]:
    # Proxy de attention rollout: gradiente sobre tokens antes de pooling.
    gap_1d = [l for l in model.layers if isinstance(l, tf.keras.layers.GlobalAveragePooling1D)]
    if not gap_1d:
        raise ValueError("No se encontro GlobalAveragePooling1D para mapa de tokens ViT.")

    token_tensor = gap_1d[-1].input
    probe_model = tf.keras.Model(model.input, [model.output, token_tensor])

    x_tf = tf.convert_to_tensor(x)
    with tf.GradientTape() as tape:
        preds, tokens = probe_model(x_tf, training=False)
        tape.watch(tokens)
        pos_score = _tf_positive_score(preds, positive_index_softmax)

    grads = tape.gradient(pos_score, tokens)
    if grads is None:
        raise ValueError("No se pudo calcular gradiente sobre tokens ViT.")

    token_importance = tf.reduce_mean(tf.abs(grads * tokens), axis=-1)[0].numpy()
    n_tokens = token_importance.shape[0]

    # Maneja ambos casos: con [CLS] o sin [CLS]
    side = int(np.sqrt(n_tokens))
    if side * side == n_tokens:
        grid = token_importance.reshape(side, side)
    else:
        side_wo_cls = int(np.sqrt(n_tokens - 1))
        if side_wo_cls * side_wo_cls == (n_tokens - 1):
            grid = token_importance[1:].reshape(side_wo_cls, side_wo_cls)
        else:
            raise ValueError(f"No se pudo convertir tokens a grilla cuadrada: n_tokens={n_tokens}")

    heatmap = _normalize_map(grid)
    heatmap = _resize_heatmap(heatmap, image_hw)

    return {
        "method": "vit_token_saliency_proxy",
        "layer": gap_1d[-1].name,
        "heatmap": heatmap,
    }


def tf_input_gradient_saliency(model, x, image_hw: Tuple[int, int], positive_index_softmax: int = 1) -> Dict[str, Any]:
    x_tf = tf.convert_to_tensor(x)
    with tf.GradientTape() as tape:
        tape.watch(x_tf)
        preds = model(x_tf, training=False)
        pos_score = _tf_positive_score(preds, positive_index_softmax)

    grads = tape.gradient(pos_score, x_tf).numpy()[0]
    sal = np.mean(np.abs(grads), axis=-1)
    heatmap = _resize_heatmap(_normalize_map(sal), image_hw)
    return {
        "method": "input_gradient_saliency",
        "layer": "input",
        "heatmap": heatmap,
    }


def compute_tf_visual_explainability(
    model,
    x,
    img_size: Tuple[int, int],
    xai_model_type: str,
    positive_index_softmax: int,
) -> Dict[str, Any]:
    resolved_type = xai_model_type
    if xai_model_type == "auto":
        resolved_type = detect_tf_model_type(model)

    if resolved_type == "cnn":
        return gradcam_for_cnn(model, x, img_size, positive_index_softmax)
    if resolved_type == "vit":
        try:
            return vit_token_saliency_map(model, x, img_size, positive_index_softmax)
        except Exception:
            return tf_input_gradient_saliency(model, x, img_size, positive_index_softmax)

    # fallback seguro
    return tf_input_gradient_saliency(model, x, img_size, positive_index_softmax)


# -------- QCNN (PyTorch) --------
def load_qcnn_model_from_script(
    script_path: str,
    checkpoint_path: str,
    device: str = "cpu",
):
    try:
        import torch
    except Exception as e:
        raise ImportError("PyTorch no disponible para QCNN") from e

    if not os.path.exists(script_path):
        raise FileNotFoundError(f"No se encontro script QCNN: {script_path}")
    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"No se encontro checkpoint QCNN: {checkpoint_path}")

    spec = importlib.util.spec_from_file_location("qcnn_module", script_path)
    module = importlib.util.module_from_spec(spec)
    assert spec is not None and spec.loader is not None
    spec.loader.exec_module(module)

    model = module.QuaternionCNN(num_classes=2)

    ckpt = torch.load(checkpoint_path, map_location=device)
    if isinstance(ckpt, dict) and "model_state" in ckpt:
        model.load_state_dict(ckpt["model_state"])
    else:
        model.load_state_dict(ckpt)

    model.to(device)
    model.eval()
    return model


def qcnn_gradient_saliency(
    model,
    image_rgb: np.ndarray,
    positive_index_softmax: int = 1,
    device: str = "cpu",
) -> Dict[str, Any]:
    try:
        import torch
    except Exception as e:
        raise ImportError("PyTorch no disponible para saliency QCNN") from e

    img = np.asarray(image_rgb, dtype=np.float32) / 255.0
    x = torch.from_numpy(img.transpose(2, 0, 1)).unsqueeze(0).to(device)
    x.requires_grad_(True)

    logits = model(x)
    probs = torch.softmax(logits, dim=1)
    score = probs[:, positive_index_softmax]

    model.zero_grad(set_to_none=True)
    score.backward(torch.ones_like(score))

    grads = x.grad.detach().cpu().numpy()[0]
    sal = np.mean(np.abs(grads), axis=0)
    sal = _normalize_map(sal)

    return {
        "method": "qcnn_input_gradient_saliency",
        "layer": "input",
        "heatmap": sal,
    }


# ============================================================
# Paso 3: Metricas morfologicas (semanticas)
# ============================================================
def rgb_to_gray(image_rgb: np.ndarray) -> np.ndarray:
    img = image_rgb.astype(np.float32)
    return 0.2989 * img[:, :, 0] + 0.5870 * img[:, :, 1] + 0.1140 * img[:, :, 2]


def rgb_to_hsv_np(image_rgb: np.ndarray) -> np.ndarray:
    img = image_rgb.astype(np.float32) / 255.0
    r, g, b = img[:, :, 0], img[:, :, 1], img[:, :, 2]
    cmax = np.max(img, axis=2)
    cmin = np.min(img, axis=2)
    delta = cmax - cmin

    h = np.zeros_like(cmax)
    s = np.zeros_like(cmax)
    v = cmax

    nonzero = delta > 1e-8
    s[nonzero] = delta[nonzero] / (cmax[nonzero] + 1e-8)

    mask_r = (cmax == r) & nonzero
    mask_g = (cmax == g) & nonzero
    mask_b = (cmax == b) & nonzero

    h[mask_r] = np.mod((g[mask_r] - b[mask_r]) / (delta[mask_r] + 1e-8), 6.0)
    h[mask_g] = ((b[mask_g] - r[mask_g]) / (delta[mask_g] + 1e-8)) + 2.0
    h[mask_b] = ((r[mask_b] - g[mask_b]) / (delta[mask_b] + 1e-8)) + 4.0
    h = (h / 6.0) % 1.0

    return np.stack([h, s, v], axis=-1)


def _neighbor_count(mask: np.ndarray) -> np.ndarray:
    m = mask.astype(np.uint8)
    acc = np.zeros_like(m, dtype=np.uint8)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            acc += np.roll(np.roll(m, dy, axis=0), dx, axis=1)
    return acc


def smooth_binary_mask(mask: np.ndarray, rounds: int = 2) -> np.ndarray:
    m = mask.copy().astype(bool)
    for _ in range(rounds):
        n = _neighbor_count(m)
        m = n >= 5
    return m


def largest_connected_component(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    best_component: List[Tuple[int, int]] = []

    for y in range(h):
        for x in range(w):
            if not mask[y, x] or visited[y, x]:
                continue

            stack = [(y, x)]
            visited[y, x] = True
            comp = []

            while stack:
                cy, cx = stack.pop()
                comp.append((cy, cx))

                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if ny < 0 or ny >= h or nx < 0 or nx >= w:
                        continue
                    if visited[ny, nx] or not mask[ny, nx]:
                        continue
                    visited[ny, nx] = True
                    stack.append((ny, nx))

            if len(comp) > len(best_component):
                best_component = comp

    out = np.zeros_like(mask, dtype=bool)
    for y, x in best_component:
        out[y, x] = True
    return out


def segment_lesion_roi(image_rgb: np.ndarray, heatmap: Optional[np.ndarray] = None) -> np.ndarray:
    gray = rgb_to_gray(image_rgb)
    hsv = rgb_to_hsv_np(image_rgb)
    sat = hsv[:, :, 1]

    dark = 1.0 - _normalize_map(gray)
    sat_norm = _normalize_map(sat)

    prior = 0.65 * dark + 0.35 * sat_norm
    if heatmap is not None:
        hm = _normalize_map(heatmap)
        prior = 0.6 * prior + 0.4 * hm

    thr = np.percentile(prior, 65)
    mask = prior >= thr
    mask = smooth_binary_mask(mask, rounds=2)
    mask = largest_connected_component(mask)

    # fallback si la segmentacion colapsa
    if mask.sum() < 50:
        thr2 = np.percentile(dark, 70)
        mask = dark >= thr2
        mask = smooth_binary_mask(mask, rounds=1)
        mask = largest_connected_component(mask)

    return mask


def _mask_perimeter(mask: np.ndarray) -> float:
    up = np.roll(mask, -1, axis=0)
    dn = np.roll(mask, 1, axis=0)
    lf = np.roll(mask, -1, axis=1)
    rg = np.roll(mask, 1, axis=1)
    inner = mask & up & dn & lf & rg
    boundary = mask & (~inner)
    return float(boundary.sum())


def _mask_bbox(mask: np.ndarray) -> Tuple[int, int, int, int]:
    ys, xs = np.where(mask)
    return int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())


def compute_morphology_metrics(image_rgb: np.ndarray, mask: np.ndarray) -> Dict[str, Any]:
    area = float(mask.sum())
    if area < 1:
        return {"error": "Mascara vacia para metricas."}

    perimeter = _mask_perimeter(mask)
    circularity = float((4.0 * np.pi * area) / (perimeter * perimeter + 1e-9))
    border_irregularity = float((perimeter * perimeter) / (4.0 * np.pi * area + 1e-9))

    flip_h = np.fliplr(mask)
    flip_v = np.flipud(mask)
    asym_h = float(np.logical_xor(mask, flip_h).sum() / (2.0 * area + 1e-9))
    asym_v = float(np.logical_xor(mask, flip_v).sum() / (2.0 * area + 1e-9))

    gray = rgb_to_gray(image_rgb)
    lesion_px = image_rgb[mask]
    bg_px = image_rgb[~mask]

    hsv = rgb_to_hsv_np(image_rgb)
    lesion_hsv = hsv[mask]

    color_std_rgb = np.std(lesion_px.astype(np.float32), axis=0)
    color_std_hsv = np.std(lesion_hsv.astype(np.float32), axis=0)

    contrast_lesion_bg = float(abs(gray[mask].mean() - gray[~mask].mean())) if bg_px.size else 0.0

    y0, y1, x0, x1 = _mask_bbox(mask)
    bbox_h = float(y1 - y0 + 1)
    bbox_w = float(x1 - x0 + 1)

    eq_diameter = float(2.0 * np.sqrt(area / np.pi))
    rel_diameter = float(eq_diameter / np.sqrt(mask.shape[0] * mask.shape[1]))

    # Textura simple (homogeneidad inversa de varianza local en lesion)
    gray_norm = _normalize_map(gray)
    neigh_mean = (
        gray_norm
        + np.roll(gray_norm, 1, 0)
        + np.roll(gray_norm, -1, 0)
        + np.roll(gray_norm, 1, 1)
        + np.roll(gray_norm, -1, 1)
    ) / 5.0
    local_var = (gray_norm - neigh_mean) ** 2
    texture_var = float(local_var[mask].mean())
    texture_homogeneity = float(1.0 / (1.0 + texture_var))

    color_std_rgb_mean = float(np.mean(color_std_rgb))

    return {
        "area_px": area,
        "perimeter_px": perimeter,
        "circularity": circularity,
        "border_irregularity_index": border_irregularity,
        "asymmetry_horizontal": asym_h,
        "asymmetry_vertical": asym_v,
        "color_std_rgb": [float(x) for x in color_std_rgb],
        "color_std_rgb_mean": color_std_rgb_mean,
        "color_std_hsv": [float(x) for x in color_std_hsv],
        "contrast_lesion_background_gray": contrast_lesion_bg,
        "bbox_height_px": bbox_h,
        "bbox_width_px": bbox_w,
        "diameter_equivalent_px": eq_diameter,
        "diameter_relative": rel_diameter,
        "texture_homogeneity_simple": texture_homogeneity,
    }


def summarize_visual_evidence(heatmap: np.ndarray) -> Dict[str, str]:
    hm = _normalize_map(heatmap)
    h, w = hm.shape

    y_idx, x_idx = np.indices((h, w))
    mass = hm + 1e-8
    x_center = float((x_idx * mass).sum() / mass.sum()) / max(w - 1, 1)
    y_center = float((y_idx * mass).sum() / mass.sum()) / max(h - 1, 1)

    if x_center < 0.35:
        x_region = "izquierda"
    elif x_center > 0.65:
        x_region = "derecha"
    else:
        x_region = "central"

    if y_center < 0.35:
        y_region = "superior"
    elif y_center > 0.65:
        y_region = "inferior"
    else:
        y_region = "media"

    active_ratio = float((hm >= np.percentile(hm, 85)).mean())
    focus = "localizada" if active_ratio < 0.22 else "difusa"

    return {
        "region": f"{y_region}-{x_region}",
        "focus": focus,
        "attention_active_ratio": active_ratio,
    }


def build_heatmap_and_overlay(image_rgb: np.ndarray, heatmap: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    hm = _normalize_map(heatmap)
    heat_rgb = (cm.jet(hm)[:, :, :3] * 255.0).astype(np.uint8)

    img_u8 = image_rgb.astype(np.uint8)
    overlay = (0.55 * img_u8 + 0.45 * heat_rgb).astype(np.uint8)
    return heat_rgb, overlay


def save_heatmap_and_overlay(image_rgb: np.ndarray, heatmap: np.ndarray, out_prefix: str) -> Dict[str, str]:
    heat_rgb, overlay = build_heatmap_and_overlay(image_rgb, heatmap)
    heat_path = f"{out_prefix}_heatmap.png"
    overlay_path = f"{out_prefix}_overlay.png"

    tf.keras.utils.save_img(heat_path, heat_rgb)
    tf.keras.utils.save_img(overlay_path, overlay)

    return {"heatmap_png": heat_path, "overlay_png": overlay_path}


def save_mask(mask: np.ndarray, out_prefix: str) -> str:
    mask_u8 = (mask.astype(np.uint8) * 255)
    path = f"{out_prefix}_lesion_mask.png"
    tf.keras.utils.save_img(path, np.expand_dims(mask_u8, axis=-1))
    return path


def save_visual_comparison_panel(
    image_rgb: np.ndarray,
    heatmap: np.ndarray,
    lesion_mask: np.ndarray,
    text_blocks: Dict[str, str],
    out_prefix: str,
) -> str:
    img_u8 = image_rgb.astype(np.uint8)
    heat_rgb, overlay = build_heatmap_and_overlay(img_u8, heatmap)
    mask_rgb = np.repeat((lesion_mask.astype(np.uint8) * 255)[:, :, None], 3, axis=2)

    top = np.concatenate([img_u8, heat_rgb], axis=1)
    bottom = np.concatenate([overlay, mask_rgb], axis=1)
    panel = np.concatenate([top, bottom], axis=0)

    panel_path = f"{out_prefix}_comparativa.png"

    # Panel unico con comparativa visual + texto en la misma imagen.
    fig = plt.figure(figsize=(14, 10), dpi=140)
    gs = fig.add_gridspec(2, 1, height_ratios=[3.2, 1.8])
    ax_img = fig.add_subplot(gs[0])
    ax_txt = fig.add_subplot(gs[1])

    ax_img.imshow(panel)
    ax_img.set_title("Comparativa visual: original | heatmap | overlay | mascara", fontsize=12)
    ax_img.axis("off")

    explanation_text = "\n\n".join([
        text_blocks.get("resultado_modelo", ""),
        text_blocks.get("evidencia_visual", ""),
        text_blocks.get("evidencia_morfologica", ""),
        text_blocks.get("advertencia_uso_clinico", ""),
    ]).strip()

    ax_txt.axis("off")
    ax_txt.text(
        0.01,
        0.99,
        explanation_text,
        va="top",
        ha="left",
        fontsize=10,
        family="monospace",
        wrap=True,
    )

    fig.tight_layout()
    fig.savefig(panel_path, bbox_inches="tight")
    plt.close(fig)
    return panel_path


# ============================================================
# Servicio de consulta (modelo cargado una sola vez)
# ============================================================
class SkinCancerInferenceService:
    def __init__(
        self,
        model_path: str = MODEL_PATH,
        img_size: Tuple[int, int] = IMG_SIZE,
        preprocess_mode: str = "resnet50",
        decision_mode: str = DECISION_MODE,
        positive_index_softmax: int = POSITIVE_INDEX_SOFTMAX,
        metrics_json_path: Optional[str] = METRICS_JSON_PATH,
        xai_model_type: str = DEFAULT_XAI_MODEL_TYPE,
    ):
        if decision_mode not in {"screening", "balance"}:
            raise ValueError("decision_mode debe ser 'screening' o 'balance'")
        if xai_model_type not in {"auto", "cnn", "vit", "qcnn"}:
            raise ValueError("xai_model_type debe ser auto/cnn/vit/qcnn")

        self.model_path = model_path
        self.img_size = img_size
        self.preprocess_mode = preprocess_mode
        self.decision_mode = decision_mode
        self.positive_index_softmax = positive_index_softmax
        self.xai_model_type = xai_model_type

        self.config = load_runtime_config(metrics_json_path)
        self.model = load_model_cached(model_path)

    def _get_threshold(self) -> float:
        threshold = self.config["thresh_screen"] if self.decision_mode == "screening" else self.config["thresh_balance"]
        if not (0.0 < threshold < 1.0):
            raise ValueError(f"Umbral invalido: {threshold}. Debe estar en (0,1)")
        return float(threshold)

    def infer_and_explain(
        self,
        image_path: str,
        run_visual_xai: bool = True,
        run_morphology: bool = True,
        save_artifacts_prefix: Optional[str] = None,
    ) -> Dict[str, Any]:
        x, img_array = preprocess_image_for_model(
            image_path=image_path,
            img_size=self.img_size,
            mode=self.preprocess_mode,
        )
        p_malignant, raw_pred, output_type = predict_malignancy_probability(
            self.model,
            x,
            positive_index_softmax=self.positive_index_softmax,
        )

        threshold = self._get_threshold()
        result: Dict[str, Any] = {}

        result["model_path"] = self.model_path
        result["image_path"] = image_path
        result["model_output_type"] = output_type
        result["raw_prediction"] = raw_pred.tolist()
        result["preprocess_mode"] = self.preprocess_mode

        xai_result = None
        visual_summary = None
        if run_visual_xai:
            xai_result = compute_tf_visual_explainability(
                model=self.model,
                x=x,
                img_size=self.img_size,
                xai_model_type=self.xai_model_type,
                positive_index_softmax=self.positive_index_softmax,
            )
            result["visual_explainability"] = {
                "method": xai_result["method"],
                "layer": xai_result["layer"],
            }
            visual_summary = summarize_visual_evidence(xai_result["heatmap"])
            result["visual_explainability"]["summary"] = visual_summary

        lesion_mask = None
        morphology = None
        if run_morphology:
            heatmap_for_seg = None if xai_result is None else xai_result["heatmap"]
            lesion_mask = segment_lesion_roi(img_array, heatmap=heatmap_for_seg)
            morphology = compute_morphology_metrics(img_array, lesion_mask)
            result["morphology_metrics"] = morphology

        text_pack = generate_text_explanation(
            p_malignant=p_malignant,
            threshold=threshold,
            decision_mode=self.decision_mode,
            neg_class_name=self.config["neg_class_name"],
            pos_class_name=self.config["pos_class_name"],
            visual_summary=visual_summary,
            morphology_summary=morphology,
        )
        result.update(text_pack)

        if run_visual_xai and save_artifacts_prefix:
            if lesion_mask is None:
                lesion_mask = segment_lesion_roi(img_array, heatmap=xai_result["heatmap"])
            panel_path = save_visual_comparison_panel(
                image_rgb=img_array,
                heatmap=xai_result["heatmap"],
                lesion_mask=lesion_mask,
                text_blocks=result["text_blocks"],
                out_prefix=save_artifacts_prefix,
            )
            result.setdefault("artifacts", {})["comparative_panel_png"] = panel_path

        return result


# ============================================================
# CLI
# ============================================================
def build_argparser():
    parser = argparse.ArgumentParser(description="Inferencia de lesion en una imagen + explicacion textual + XAI")
    parser.add_argument("--image", required=True, help="Ruta a la imagen a evaluar")
    parser.add_argument("--model", default=MODEL_PATH, help="Ruta al modelo .keras/.h5")
    parser.add_argument("--img-size", default=f"{IMG_SIZE[0]},{IMG_SIZE[1]}", help="Formato: alto,ancho. Ej: 224,224")
    parser.add_argument("--preprocess", default="resnet50", choices=["resnet50", "simple_0_1"], help="Modo de preprocesamiento")
    parser.add_argument("--mode", default=DECISION_MODE, choices=["screening", "balance"], help="Modo de decision")
    parser.add_argument("--positive-index", type=int, default=POSITIVE_INDEX_SOFTMAX, choices=[0, 1], help="Indice de clase positiva en softmax")
    parser.add_argument("--metrics-json", default=METRICS_JSON_PATH, help="JSON de metricas para clases/umbrales")
    parser.add_argument("--xai-model-type", default=DEFAULT_XAI_MODEL_TYPE, choices=["auto", "cnn", "vit", "qcnn"], help="Tipo de modelo para XAI")
    parser.add_argument("--no-xai", action="store_true", help="Desactiva explicabilidad visual")
    parser.add_argument("--no-morphology", action="store_true", help="Desactiva metricas morfologicas")
    parser.add_argument("--artifact-prefix", default="resultado", help="Prefijo para la comparativa final")
    parser.add_argument("--out-json", default=None, help="Archivo JSON de salida (opcional)")
    return parser


def parse_img_size(img_size_str: str) -> Tuple[int, int]:
    try:
        h, w = img_size_str.split(",")
        return int(h), int(w)
    except Exception as e:
        raise ValueError("--img-size debe tener formato alto,ancho. Ej: 224,224") from e


def main():
    args = build_argparser().parse_args()

    service = SkinCancerInferenceService(
        model_path=args.model,
        img_size=parse_img_size(args.img_size),
        preprocess_mode=args.preprocess,
        decision_mode=args.mode,
        positive_index_softmax=args.positive_index,
        metrics_json_path=args.metrics_json,
        xai_model_type=args.xai_model_type,
    )

    result = service.infer_and_explain(
        image_path=args.image,
        run_visual_xai=not args.no_xai,
        run_morphology=not args.no_morphology,
        save_artifacts_prefix=args.artifact_prefix,
    )

    print("\n================ RESULTADO ================")
    print(f"Imagen: {result['image_path']}")
    print(f"Modelo: {result['model_path']}")
    print(f"Tipo de salida del modelo: {result['model_output_type']}")
    print(f"Probabilidad de malignidad: {result['p_malignant']:.4f}")
    print(f"Umbral usado ({result['decision_mode']}): {result['threshold']}")
    print(f"Clase predicha: {result['predicted_class']}")
    print(f"Confianza relativa al umbral: {result['confidence_relative_to_threshold']}")

    if "visual_explainability" in result:
        print("\nExplicabilidad visual:")
        print(f"- Metodo: {result['visual_explainability']['method']}")
        print(f"- Capa: {result['visual_explainability']['layer']}")

    if "morphology_metrics" in result:
        mm = result["morphology_metrics"]
        print("\nMetricas morfologicas (ABCDE proxy):")
        if "error" in mm:
            print(f"- Error: {mm['error']}")
        else:
            print(f"- Asimetria H/V: {mm['asymmetry_horizontal']:.3f} / {mm['asymmetry_vertical']:.3f}")
            print(f"- Irregularidad borde: {mm['border_irregularity_index']:.3f}")
            print(f"- Circularidad: {mm['circularity']:.3f}")
            print(f"- Contraste lesion-fondo: {mm['contrast_lesion_background_gray']:.3f}")
            print(f"- Diametro equivalente (px): {mm['diameter_equivalent_px']:.1f}")
            print(f"- Textura homogeneidad: {mm['texture_homogeneity_simple']:.3f}")

    print("\nExplicacion textual:")
    print(result["text_explanation"])

    if args.out_json:
        with open(args.out_json, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"\nGuardado JSON: {args.out_json}")
    if "artifacts" in result:
        print("Artefactos generados:")
        for k, v in result["artifacts"].items():
            print(f"- {k}: {v}")


if __name__ == "__main__":
    main()
