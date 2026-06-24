-- Gestão de Utilizadores: permitir que staff/admin vejam e atualizem perfis além do próprio.
-- Sem isto, RLS só permite SELECT/UPDATE quando auth.uid() = id e a lista mostra apenas 1 utilizador.
-- Aplicado no projecto NATUR ERVA ERP (oiiscvsqqmkewsmxrfdy) via migração profiles_rls_staff_select_all / profiles_rls_staff_can_update_others.

CREATE OR REPLACE FUNCTION public.can_view_all_profiles()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT
        (p.is_super_admin IS TRUE)
        OR (
          p.role IS NOT NULL
          AND p.role <> 'CLIENTE'
          AND p.role IN (
            'SUPER_ADMIN', 'ADMIN', 'STAFF', 'CONTABILISTA', 'GESTOR_STOCK',
            'GESTOR_VENDAS', 'GESTOR_ENTREGAS', 'GERENTE', 'VENDEDOR'
          )
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_roles ur
          INNER JOIN public.roles r ON r.id = ur.role_id
          WHERE ur.user_id = auth.uid()
            AND r.name IN (
              'SUPER_ADMIN', 'ADMIN', 'STAFF', 'CONTABILISTA', 'GESTOR_STOCK',
              'GESTOR_VENDAS', 'GESTOR_ENTREGAS', 'GERENTE', 'VENDEDOR'
            )
        )
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ),
    false
  );
$$;

COMMENT ON FUNCTION public.can_view_all_profiles() IS
  'RLS: utilizadores internos (staff/admin) podem listar/gerir perfis; alinhado com useUserPermissions.';

GRANT EXECUTE ON FUNCTION public.can_view_all_profiles() TO authenticated;

DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
CREATE POLICY "Staff can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.can_view_all_profiles());

DROP POLICY IF EXISTS "Staff can update profiles for user management" ON public.profiles;
CREATE POLICY "Staff can update profiles for user management"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.can_view_all_profiles())
  WITH CHECK (public.can_view_all_profiles());
