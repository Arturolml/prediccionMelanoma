-- Fase 14: integración de los modelos nuevos de IA.
-- Aplicar una vez sobre la base existente (no borra datos; se puede repetir):
--   docker compose exec -T db_postgres psql -U prediccion -d prediccion-db < backend-prediccion-app/prisma/migraciones/2026-10-28_fase14_ia.sql
BEGIN;

-- Sitio anatómico de la lesión con los valores del modelo de Fusión.
-- Las lesiones existentes quedan en 'unknown' hasta que se editen.
ALTER TABLE lesiones ADD COLUMN IF NOT EXISTS sitio_anatomico VARCHAR(30) NOT NULL DEFAULT 'unknown';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesiones_sitio_anatomico_check') THEN
    ALTER TABLE lesiones ADD CONSTRAINT lesiones_sitio_anatomico_check CHECK (sitio_anatomico IN (
      'abdomen', 'acral', 'back', 'chest', 'ear', 'face', 'foot', 'genital', 'hand', 'head/neck',
      'lower extremity', 'neck', 'scalp', 'trunk', 'unknown', 'upper extremity'));
  END IF;
END $$;

-- Resultado de la IA por evaluación. prediccion_ia sigue siendo la probabilidad
-- de Fusión (0-100); en las evaluaciones anteriores, version_modelos_ia queda NULL
-- (modelo Keras anterior).
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS prob_qresnet NUMERIC(5, 2);
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS decision_ia VARCHAR(20);
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS ia_revisar_caso BOOLEAN;
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS version_modelos_ia VARCHAR(40);
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS resultado_ia JSONB;
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS ruta_mapa_fusion VARCHAR(255);
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS ruta_mapa_qresnet VARCHAR(255);
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS ruta_contorno_lesion VARCHAR(255);

COMMIT;
