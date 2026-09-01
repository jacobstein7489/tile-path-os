-- crews
DROP POLICY IF EXISTS "Open access to crews" ON public.crews;
CREATE POLICY "Staff read crews" ON public.crews FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert crews" ON public.crews FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update crews" ON public.crews FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Data admins delete crews" ON public.crews FOR DELETE TO authenticated USING (public.can_admin_data(auth.uid()));
REVOKE ALL ON public.crews FROM anon;

-- schedule
DROP POLICY IF EXISTS "Open access to schedule" ON public.schedule_assignments;
CREATE POLICY "Staff manage schedule" ON public.schedule_assignments FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
REVOKE ALL ON public.schedule_assignments FROM anon;

-- material items
DROP POLICY IF EXISTS "Open access to material items" ON public.material_items;
CREATE POLICY "Staff manage material items" ON public.material_items FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
REVOKE ALL ON public.material_items FROM anon;

-- purchase orders
DROP POLICY IF EXISTS "Open access to purchase orders" ON public.purchase_orders;
CREATE POLICY "Staff read purchase orders" ON public.purchase_orders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert purchase orders" ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update purchase orders" ON public.purchase_orders FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Data admins delete purchase orders" ON public.purchase_orders FOR DELETE TO authenticated USING (public.can_admin_data(auth.uid()));
REVOKE ALL ON public.purchase_orders FROM anon;

-- po lines
DROP POLICY IF EXISTS "Open access to po lines" ON public.po_lines;
CREATE POLICY "Staff read po lines" ON public.po_lines FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert po lines" ON public.po_lines FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update po lines" ON public.po_lines FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Data admins delete po lines" ON public.po_lines FOR DELETE TO authenticated USING (public.can_admin_data(auth.uid()));
REVOKE ALL ON public.po_lines FROM anon;

-- receipts (append-only)
DROP POLICY IF EXISTS "Anyone can add receipts" ON public.material_receipts;
DROP POLICY IF EXISTS "Anyone can read receipts" ON public.material_receipts;
CREATE POLICY "Staff read receipts" ON public.material_receipts FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff add receipts" ON public.material_receipts FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
REVOKE ALL ON public.material_receipts FROM anon;

-- visit checklist
DROP POLICY IF EXISTS "Open access to visit checklist" ON public.visit_checklist_items;
CREATE POLICY "Staff manage visit checklist" ON public.visit_checklist_items FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
REVOKE ALL ON public.visit_checklist_items FROM anon;

-- work item history (append-only)
DROP POLICY IF EXISTS "Anyone can add work item history" ON public.work_item_events;
DROP POLICY IF EXISTS "Anyone can read work item history" ON public.work_item_events;
CREATE POLICY "Staff read work item history" ON public.work_item_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff add work item history" ON public.work_item_events FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
REVOKE ALL ON public.work_item_events FROM anon;