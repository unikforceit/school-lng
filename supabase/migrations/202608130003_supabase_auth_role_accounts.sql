-- Link hosted Supabase Auth identities to tenant-scoped SIME roles.
alter table public.users add column if not exists auth_user_id uuid;
create unique index if not exists users_auth_user_id_key on public.users(auth_user_id) where auth_user_id is not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='users_auth_user_id_fkey' and conrelid='public.users'::regclass) then
    alter table public.users add constraint users_auth_user_id_fkey foreign key(auth_user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

insert into public.tenants(id,name,active,plan,license_status,license_expires_at,max_students,max_users,contact_email) values
  ('platform','SIME Platform',true,'enterprise','active',null,1000000,100000,''),
  ('demo-school','SIME Demo School',true,'pro','active',now()+interval '1 year',5000,500,'admin@sime.local'),
  ('sample-academy','Sample Academy',true,'starter','active',now()+interval '1 year',500,100,'principal@sample.local')
on conflict(id) do update set name=excluded.name,active=true,license_status='active',license_expires_at=excluded.license_expires_at,contact_email=excluded.contact_email;

insert into public.security_settings(tenant_id,session_hours) values ('platform',168),('demo-school',168),('sample-academy',168)
on conflict(tenant_id) do update set session_hours=excluded.session_hours;
insert into public.ai_settings(tenant_id) values ('platform'),('demo-school'),('sample-academy') on conflict do nothing;
insert into public.gamification_settings(tenant_id) values ('platform'),('demo-school'),('sample-academy') on conflict do nothing;
insert into public.developer_api_settings(tenant_id) values ('platform'),('demo-school'),('sample-academy') on conflict do nothing;

with role_accounts(email,name,role,tenant_id) as (values
  ('superadmin@sime.local','SIME Platform Owner','superadmin','platform'),
  ('admin@sime.local','Devon Harper','admin','demo-school'),
  ('teacher@sime.local','Emily Anderson','teacher','demo-school'),
  ('student@sime.local','Jessica Rose','student','demo-school'),
  ('parent@sime.local','Sophia Brown','parent','demo-school'),
  ('principal@sample.local','Morgan Lee','admin','sample-academy')
)
insert into public.users(auth_user_id,tenant_id,email,name,role,password_hash,active)
select au.id,ra.tenant_id,lower(ra.email),ra.name,ra.role,'managed-by-supabase-auth',true
from role_accounts ra join auth.users au on lower(au.email)=lower(ra.email)
on conflict(tenant_id,email) do update set auth_user_id=excluded.auth_user_id,name=excluded.name,role=excluded.role,password_hash='managed-by-supabase-auth',active=true;

with role_accounts(email,name,role,tenant_id) as (values
  ('superadmin@sime.local','SIME Platform Owner','superadmin','platform'),
  ('admin@sime.local','Devon Harper','admin','demo-school'),
  ('teacher@sime.local','Emily Anderson','teacher','demo-school'),
  ('student@sime.local','Jessica Rose','student','demo-school'),
  ('parent@sime.local','Sophia Brown','parent','demo-school'),
  ('principal@sample.local','Morgan Lee','admin','sample-academy')
)
update auth.users au set raw_app_meta_data=coalesce(au.raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('role',ra.role,'tenant_id',ra.tenant_id,'display_name',ra.name),updated_at=now()
from role_accounts ra where lower(au.email)=lower(ra.email);

insert into public.schema_migrations(version) values('supabase-auth-role-accounts-v1') on conflict do nothing;
