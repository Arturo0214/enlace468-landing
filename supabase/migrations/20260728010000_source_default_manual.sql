-- Garantía "todo lo manual queda marcado" (pedido de Arturo 2026-07-28):
-- los flujos AUTOMÁTICOS siempre declaran su source explícito (web-sourced,
-- xray, sourced, meta_ads…); cualquier alta que NO declare source viene de
-- una persona → default 'manual'. Así ningún candidato queda sin distinguir.
ALTER TABLE candidates ALTER COLUMN source SET DEFAULT 'manual';
ALTER TABLE sourcing_bank ALTER COLUMN source SET DEFAULT 'manual';
