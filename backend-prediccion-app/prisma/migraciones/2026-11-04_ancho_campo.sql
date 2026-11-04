-- Escala de la foto de cada evaluación (ancho real que abarca, en mm).
-- Aplicar una vez sobre la base existente (no borra datos; se puede repetir):
--   docker compose exec -T db_postgres psql -U prediccion -d prediccion-db < backend-prediccion-app/prisma/migraciones/2026-11-04_ancho_campo.sql
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS ancho_campo_mm NUMERIC(6, 2);
