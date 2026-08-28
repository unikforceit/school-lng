-- Rename only the six managed demo identities; unrelated Supabase users are untouched.
do $$
declare item record;
begin
  for item in select * from (values
    ('superadmin@sime.local','superadmin@school-ing.gn','Mamadou Diallo'),
    ('admin@sime.local','admin@school-ing.gn','Aïssatou Camara'),
    ('teacher@sime.local','teacher@school-ing.gn','Ibrahima Condé'),
    ('student@sime.local','student@school-ing.gn','Mariama Bah'),
    ('parent@sime.local','parent@school-ing.gn','Fatoumata Sylla'),
    ('principal@sample.local','direction@academie-kankan.gn','Alpha Soumah')
  ) as mapping(old_email,new_email,display_name)
  loop
    update auth.users set
      email=item.new_email,
      raw_app_meta_data=jsonb_set(raw_app_meta_data,'{display_name}',to_jsonb(item.display_name),true),
      raw_user_meta_data=jsonb_set(jsonb_set(raw_user_meta_data,'{email}',to_jsonb(item.new_email),true),'{display_name}',to_jsonb(item.display_name),true),
      updated_at=now()
    where email=item.old_email;
    update auth.identities set
      identity_data=jsonb_set(jsonb_set(identity_data,'{email}',to_jsonb(item.new_email),true),'{display_name}',to_jsonb(item.display_name),true),
      updated_at=now()
    where user_id=(select id from auth.users where email=item.new_email) and provider='email';
  end loop;
end $$;
