-- Allow authenticated users to create their own profile row when the signup
-- trigger was skipped or failed.
create policy "users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());