-- Permitir ELIMINAR vacantes (Karina duplicó una por error y no podía quitarla).
-- La política RLS de DELETE ya existe; lo que bloqueaba era el FK de
-- intake_sessions (sin ON DELETE). Un registro hijo de una vacante eliminada
-- no sirve de nada → todo FK hacia vacancies sin regla de borrado pasa a CASCADE.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tc.table_name, tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'vacancies'
      AND rc.delete_rule = 'NO ACTION'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.vacancies(id) ON DELETE CASCADE',
      r.table_name, r.constraint_name, r.column_name
    );
  END LOOP;
END $$;
