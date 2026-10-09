-- Acceso de prueba con vencimiento: usuarios test/demo caducan solos.
-- NULL = usuario normal sin vencimiento. La app (AuthProvider) cierra la
-- sesión cuando trial_expires_at < now().
alter table public.profiles add column if not exists trial_expires_at timestamptz;
