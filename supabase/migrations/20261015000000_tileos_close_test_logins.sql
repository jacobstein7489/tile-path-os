-- The first version made four throwaway test logins (qa.*@cobblestone.test) for one round of testing.
-- Now that the app holds the company's data, they lose their access and drop off the sign-up list.
delete from public.user_roles
where user_id in (select id from auth.users where email like 'qa.%@cobblestone.test');

update public.profiles set is_active = false
where user_id in (select id from auth.users where email like 'qa.%@cobblestone.test');
