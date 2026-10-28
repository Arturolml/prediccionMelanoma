"""
Arquitecturas de los modelos de la app, solo lo necesario para inferencia.

Copias de las definiciones de entrenamiento del repo de modelos
skin-lesion-classification-rna2026 (fuente de verdad):
- QuaternionResNetHybrid  <- 02_src/QCNN/qresnet_hybrid.py
- ImageMetadataFusionModel <- 02_src/Fusion/modelo_fusion.py
- MetadataEncoder          <- 02_src/Fusion/dataset_metadatos.py
- segmentador y preparar_imagen_segmentacion <- 02_src/Segmentacion/entrenar_segmentacion.py

Se copian para que el paquete sea autocontenido (se despliega en la API de la
app sin los modulos de entrenamiento, que arrastran sklearn, matplotlib y
rutas de datos). Si cambia una arquitectura en 02_src, hay que cambiarla aqui;
la prueba 06_app_ia/pruebas/comparar_con_xai_app.py del repo de modelos
detecta cualquier diferencia.
"""

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision
from PIL import Image
from torchvision.transforms import functional as TF

MEDIA_IMAGENET, STD_IMAGENET = (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)
LADO_SEGMENTACION = 384


def resnet50_sin_cabeza():
    backbone = torchvision.models.resnet50(weights=None)
    feat_dim = backbone.fc.in_features
    backbone.fc = nn.Identity()
    return backbone, feat_dim


class QuaternionLinear(nn.Module):
    def __init__(self, in_features, out_features):
        super().__init__()
        self.fcs = nn.ModuleList([nn.Linear(in_features, out_features, bias=True) for _ in range(4)])

    def forward(self, x):
        r, i, j, k = x
        R = self.fcs[0](r) - self.fcs[1](i) - self.fcs[2](j) - self.fcs[3](k)
        I = self.fcs[0](i) + self.fcs[1](r) + self.fcs[2](k) - self.fcs[3](j)
        J = self.fcs[0](j) - self.fcs[1](k) + self.fcs[2](r) + self.fcs[3](i)
        K = self.fcs[0](k) + self.fcs[1](j) - self.fcs[2](i) + self.fcs[3](r)
        return [R, I, J, K]


class QuaternionResNetHybrid(nn.Module):
    def __init__(self, num_classes=2, q_hidden=256, dropout_p=0.25):
        super().__init__()
        self.backbone, feat_dim = resnet50_sin_cabeza()
        self.to_quaternion = nn.Linear(feat_dim, q_hidden * 4)
        self.qfc1 = QuaternionLinear(q_hidden, q_hidden)
        self.qfc2 = QuaternionLinear(q_hidden, q_hidden // 2)
        self.dropout = nn.Dropout(dropout_p)
        self.fc_mid = nn.Linear((q_hidden // 2) * 4, 256)
        self.fc_out = nn.Linear(256, num_classes)

    def forward(self, x):
        q = list(torch.chunk(self.to_quaternion(self.backbone(x)), 4, dim=1))
        q = [F.relu(c, inplace=True) for c in self.qfc1(q)]
        q = [F.relu(c, inplace=True) for c in self.qfc2(q)]
        out = self.dropout(torch.cat(q, dim=1))
        out = self.dropout(F.relu(self.fc_mid(out), inplace=True))
        return self.fc_out(out)


class MetadataMLP(nn.Module):
    def __init__(self, n_features, hidden=64, out_dim=32, dropout_p=0.20):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_features, hidden), nn.BatchNorm1d(hidden), nn.ReLU(inplace=True), nn.Dropout(dropout_p),
            nn.Linear(hidden, out_dim), nn.BatchNorm1d(out_dim), nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.net(x)


class ImageMetadataFusionModel(nn.Module):
    """Fusion tardia: embedding de imagen (ResNet50) + embedding de metadatos -> clasificador."""

    def __init__(self, n_meta_features, num_classes=2, meta_hidden=64, meta_out=32, img_embed_dim=256,
                 dropout_p=0.25, n_aux_classes=0):
        super().__init__()
        self.backbone, feat_dim = resnet50_sin_cabeza()
        self.image_proj = nn.Sequential(
            nn.Linear(feat_dim, img_embed_dim), nn.BatchNorm1d(img_embed_dim), nn.ReLU(inplace=True), nn.Dropout(dropout_p))
        self.meta_branch = MetadataMLP(n_meta_features, hidden=meta_hidden, out_dim=meta_out, dropout_p=dropout_p)
        fused_dim = img_embed_dim + meta_out
        self.classifier = nn.Sequential(
            nn.Linear(fused_dim, 128), nn.ReLU(inplace=True), nn.Dropout(dropout_p), nn.Linear(128, num_classes))
        # Cabeza auxiliar de diagnosticos: solo se uso en entrenamiento; se
        # define para que el state_dict cargue sin claves sobrantes.
        self.aux_classifier = nn.Linear(fused_dim, n_aux_classes) if n_aux_classes > 0 else None

    def forward(self, img, meta):
        return self.clasificar(self.image_proj(self.backbone(img)), meta)

    def clasificar(self, img_emb, meta):
        """Logits a partir del embedding de imagen ya calculado (permite reevaluar solo los metadatos)."""
        return self.classifier(torch.cat([img_emb, self.meta_branch(meta)], dim=1))


class MetadataEncoder:
    """Edad (z-score; vacia -> media), sexo (one-hot) y localizacion (one-hot + 'other')."""

    def __init__(self, d):
        self.sex_categories = d["sex_categories"]
        self.loc_categories = d["loc_categories"]
        self.age_mean = d["age_mean"]
        self.age_std = d["age_std"]

    def encode(self, row):
        age_raw = row.get("age", "")
        age_norm = 0.0 if age_raw in ("", "nan", "NaN") else (float(age_raw) - self.age_mean) / self.age_std
        sex = row.get("sex", "unknown")
        sex_vec = [1.0 if sex == c else 0.0 for c in self.sex_categories]
        loc = row.get("localization", "unknown")
        if loc in self.loc_categories:
            loc_vec = [1.0 if loc == c else 0.0 for c in self.loc_categories] + [0.0]
        else:
            loc_vec = [0.0] * len(self.loc_categories) + [1.0]
        return np.array([age_norm] + sex_vec + loc_vec, dtype=np.float32)


def segmentador():
    """DeepLabV3 + ResNet50 de una clase (lesion)."""
    return torchvision.models.segmentation.deeplabv3_resnet50(
        weights=None, weights_backbone=None, num_classes=1, aux_loss=False)


def preparar_imagen_segmentacion(imagen_pil):
    return TF.normalize(TF.to_tensor(imagen_pil.convert("RGB").resize(
        (LADO_SEGMENTACION, LADO_SEGMENTACION), Image.BILINEAR)), MEDIA_IMAGENET, STD_IMAGENET)
