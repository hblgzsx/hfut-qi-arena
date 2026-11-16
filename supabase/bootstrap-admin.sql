-- Run AFTER this account has registered and confirmed its email.
update public.profiles p set role='admin'
from auth.users u
where p.id=u.id and lower(u.email)='YOUR_ADMIN_EMAIL' and u.email_confirmed_at is not null;
select display_name,email,role from public.profiles where lower(email)='YOUR_ADMIN_EMAIL';
