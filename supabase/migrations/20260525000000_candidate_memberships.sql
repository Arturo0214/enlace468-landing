-- ============================================================
-- Enlace 468 - Candidate Membership Plans
-- Migration 003: Candidate tiers (Basic, Plus, Pro)
-- ============================================================

-- Add 'candidate' to allowed product_line values
ALTER TABLE plans DROP CONSTRAINT plans_product_line_check;
ALTER TABLE plans ADD CONSTRAINT plans_product_line_check
  CHECK (product_line IN ('enterprise', 'talent_desk', 'recruiter_pro', 'academy', 'tu_marca_vende', 'candidate'));

INSERT INTO plans (product_line, tier, name, price_mxn, billing_cycle, setup_fee_mxn, features, limits, sort_order) VALUES
('candidate', 'basic', 'Candidate Basic', 0, 'monthly', 0,
 '["Perfil visible para reclutadores","Alertas basicas de vacantes","Acceso al ecosistema Enlace 468"]',
 '{}', 1),
('candidate', 'plus', 'Candidate Plus', 199, 'monthly', 0,
 '["Todo Basic incluido","Contenido premium semanal","Recomendaciones de vacantes","Tips de visibilidad","Recursos descargables"]',
 '{}', 2),
('candidate', 'pro', 'Candidate Pro', 349, 'monthly', 0,
 '["Todo Plus incluido","Alertas prioritarias","Optimizacion periodica de perfil","Recursos premium","Visibilidad destacada en marketplace"]',
 '{}', 3);
