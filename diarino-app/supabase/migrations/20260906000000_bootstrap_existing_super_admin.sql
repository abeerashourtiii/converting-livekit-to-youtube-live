-- Bootstrap the first account when the super-admin migration was deployed
-- after users already existed. The insert is a no-op once any role exists.
do $$
begin
  if not exists (select 1 from public.user_roles) then
    insert into public.user_roles (user_id, role, is_super_admin, full_access, permissions)
    select id, 'admin', true, true, '{}'
    from auth.users
    order by created_at asc
    limit 1;
  end if;
end;
$$;
