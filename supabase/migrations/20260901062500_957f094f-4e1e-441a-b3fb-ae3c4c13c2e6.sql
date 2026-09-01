UPDATE public.projects SET next_move_owner = CASE next_move_owner
  WHEN 'Office' THEN 'QA Office Coordinator'
  WHEN 'Office / Materials' THEN 'QA Office Coordinator'
  WHEN 'PM' THEN 'QA Project Manager'
  WHEN 'Site Manager' THEN 'QA Site Manager'
  ELSE next_move_owner END
WHERE next_move_owner IN ('Office','Office / Materials','PM','Site Manager');

UPDATE public.work_items wi SET owner_user_id = p.user_id, owner = p.full_name
FROM public.profiles p
WHERE wi.owner_user_id IS NULL
  AND p.full_name = CASE wi.owner
    WHEN 'Office' THEN 'QA Office Coordinator'
    WHEN 'Office / Materials' THEN 'QA Office Coordinator'
    WHEN 'PM' THEN 'QA Project Manager'
    WHEN 'Designer / PM' THEN 'QA Project Manager'
    WHEN 'Site Manager' THEN 'QA Site Manager'
    ELSE NULL END;