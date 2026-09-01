-- ============ Sprint 1 QA data alignment ============
DO $$
DECLARE
  v_admin uuid;
  v_pm uuid;
  v_site uuid;
  v_office uuid;
  v_sandbox uuid;
BEGIN
  SELECT user_id INTO v_admin FROM public.profiles WHERE email = 'yankys@cobblestonenj.com';
  SELECT user_id INTO v_pm FROM public.profiles WHERE email = 'qa.pm@cobblestone.test';
  SELECT user_id INTO v_site FROM public.profiles WHERE email = 'qa.site@cobblestone.test';
  SELECT user_id INTO v_office FROM public.profiles WHERE email = 'qa.office@cobblestone.test';

  UPDATE public.profiles SET full_name='Yanky Stein', initials='YS', job_title='Administrator'
   WHERE user_id = v_admin;
  UPDATE public.profiles SET initials='QP', job_title='Project Manager (QA)' WHERE user_id = v_pm;
  UPDATE public.profiles SET initials='QS', job_title='Site Manager (QA)' WHERE user_id = v_site;
  UPDATE public.profiles SET initials='QO', job_title='Office Coordinator (QA)' WHERE user_id = v_office;

  -- Real owners on every project instead of generic text
  UPDATE public.projects
     SET pm_user_id = COALESCE(pm_user_id, v_admin),
         project_manager = 'Yanky Stein'
   WHERE archived_at IS NULL;

  UPDATE public.projects
     SET site_manager_user_id = v_site
   WHERE archived_at IS NULL
     AND lifecycle_stage IN ('Installation','Closeout / Return','Scheduled');

  -- Project A: assigned to the QA PM and QA Site Manager
  UPDATE public.projects
     SET pm_user_id = v_pm, project_manager = 'QA Project Manager'
   WHERE name = '8-28 Clyde';

  INSERT INTO public.project_assignments (project_id, user_id, role_in_project)
  SELECT p.id, v_pm, 'Project Manager' FROM public.projects p WHERE p.name = '8-28 Clyde'
  ON CONFLICT (project_id, user_id, role_in_project) DO NOTHING;

  INSERT INTO public.project_assignments (project_id, user_id, role_in_project)
  SELECT p.id, v_site, 'Site Manager' FROM public.projects p WHERE p.name = '8-28 Clyde'
  ON CONFLICT (project_id, user_id, role_in_project) DO NOTHING;

  -- Project B stays deliberately unassigned for isolation testing
  DELETE FROM public.project_assignments pa
   USING public.projects p
   WHERE pa.project_id = p.id
     AND p.name = '24 Cambridge'
     AND pa.user_id IN (v_pm, v_site, v_office);

  -- Real people on work items
  UPDATE public.work_items SET owner_user_id = v_pm,    owner = 'QA Project Manager'
   WHERE owner_user_id IS NULL AND owner IN ('PM');
  UPDATE public.work_items SET owner_user_id = v_site,  owner = 'QA Site Manager'
   WHERE owner_user_id IS NULL AND owner IN ('Site Manager','Philip');
  UPDATE public.work_items SET owner_user_id = v_office, owner = 'QA Office Coordinator'
   WHERE owner_user_id IS NULL AND owner IN ('Office','Office Team','Office / Materials');
  UPDATE public.work_items SET owner_user_id = v_admin, owner = 'Yanky Stein'
   WHERE owner_user_id IS NULL;

  -- Give the signed-in administrator live rows on Today
  UPDATE public.work_items w
     SET owner_user_id = v_admin, owner = 'Yanky Stein'
   WHERE w.id IN (
     SELECT w2.id FROM public.work_items w2
      JOIN public.projects p ON p.id = w2.project_id
      WHERE p.name IN ('Millennium','Fire Circle','115 Park')
   );

  -- Reopen a realistic working set so Company Work / Today are not empty
  UPDATE public.work_items SET status = 'Open', completed_at = NULL
   WHERE status = 'Complete'
     AND project_id IN (SELECT id FROM public.projects
                         WHERE name IN ('Millennium','Fire Circle','8-28 Clyde','Mark Drive',
                                        '114 Park Place','2385 Forest Circle','8-30 Northwood'));

  UPDATE public.work_items SET next_action = COALESCE(NULLIF(next_action,'Completed'), 'Confirm and close')
   WHERE status <> 'Complete';

  -- 114 Park Place is the Setup reference project
  UPDATE public.projects
     SET lifecycle_stage = 'Setup',
         exception_state = NULL,
         readiness_pct = 40,
         installation_progress = 0,
         crew_lead = NULL,
         stage_steps_done = ARRAY['Project Info','Scope & Plans'],
         readiness_note = 'Tiles & finishes, install materials and site conditions still outstanding.',
         needs_attention = 'Shower wall tile selection unanswered for Master Bathroom',
         next_move = 'Confirm shower wall tile selection with the owner',
         next_move_owner = 'QA Project Manager'
   WHERE name = '114 Park Place';

  -- Disposable sandbox project for destructive tests
  SELECT id INTO v_sandbox FROM public.projects WHERE name = 'ZZ QA Sandbox — disposable';
  IF v_sandbox IS NULL THEN
    INSERT INTO public.projects
      (name, address, project_type, lifecycle_stage, readiness_pct, installation_progress,
       material_status, next_move, next_move_owner, created_by, pm_user_id, project_manager,
       intake_notes)
    VALUES
      ('ZZ QA Sandbox — disposable', '1 Test Street', 'New Job', 'New Submission', 0, 0,
       'Needed', 'Sprint 1 QA only — safe to archive or delete', 'Yanky Stein', v_admin, v_admin,
       'Yanky Stein', 'Disposable record used only for Sprint 1 archive/delete testing.');
  END IF;
END $$;
