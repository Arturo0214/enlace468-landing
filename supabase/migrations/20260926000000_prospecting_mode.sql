-- Modo prospección de VENTA (campañas PPR/fiscal en enlace468, 2026-09-26):
-- la "vacante" busca COMPRADORES (médicos, dueños de PyME…), no vendedores.
-- El gate salta el descarte de "rol especializado" (el médico ES el target);
-- anti-extranjero, anti-basura y veto de competencia (seguros) siguen igual.
ALTER TABLE public.vacancies
  ADD COLUMN IF NOT EXISTS prospecting_mode boolean NOT NULL DEFAULT false;
