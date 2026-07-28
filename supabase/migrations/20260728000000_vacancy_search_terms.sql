-- Términos de búsqueda "ganadores" por vacante para el sourcing automático.
-- Feedback de Karina (2026-07-28): sus búsquedas manuales con "Ejecutivo de
-- ventas" / "Coordinador Comercial" / "Ejecutivo Comercial" en CDMX/QRO
-- responden en 24-48h, mientras el auto-sourcing armaba queries con el título
-- de la vacante ("FINANCE CONSULTANT") que no es como la gente se describe.
ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS search_terms text[];
