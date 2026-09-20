import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BriefcaseBusiness } from "lucide-react";
import { CenterDialog } from "@/components/ops/CenterDialog";
import { Button, Combobox, Field, Select, TextArea, TextInput } from "@/components/kit";
import { useAuthUser } from "@/hooks/useAuth";
import { useInsertRow } from "@/lib/data";
import {
  companyOptions,
  contactOptions,
  useCompanies,
  useContacts,
  useSaveCompany,
  useSaveContact,
} from "@/lib/people";
import { VNextMark } from "@/components/vnext/VNextPrimitives";

const EMPTY = {
  name: "",
  address: "",
  source: "",
  customer_company_id: null as string | null,
  gc_company_id: null as string | null,
  primary_contact_id: null as string | null,
  estimator_user_id: null as string | null,
  bid_due_date: "",
  follow_up_date: "",
  intake_notes: "",
};

export function VNextNewJob({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY);
  const insert = useInsertRow("projects");
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const { data: companies = [] } = useCompanies();
  const { data: contacts = [] } = useContacts();
  const saveCompany = useSaveCompany();
  const saveContact = useSaveContact();
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (form.name.trim().length < 2) return;
    const row = (await insert.mutateAsync({
      name: form.name.trim(),
      address: form.address || null,
      project_type: "New Job",
      lifecycle_stage: "New Submission",
      source: form.source || null,
      customer_company_id: form.customer_company_id,
      gc_company_id: form.gc_company_id,
      primary_contact_id: form.primary_contact_id,
      estimator_user_id: form.estimator_user_id,
      bid_due_date: form.bid_due_date || null,
      follow_up_date: form.follow_up_date || null,
      intake_notes: form.intake_notes || null,
      created_by: user?.id ?? null,
    })) as { id?: string } | null;
    setForm(EMPTY);
    onClose();
    if (row?.id) navigate({ to: "/vnext/jobs/$jobId/estimate", params: { jobId: row.id } });
  };
  return (
    <CenterDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="New price request"
      className="sm:max-w-[780px]"
      bodyClassName="bg-vnext-canvas"
    >
      <div className="vnext">
        <header className="flex items-start gap-4 border-b border-vnext-line bg-vnext-surface px-5 py-5 sm:px-7">
          <VNextMark tone="ink">
            <BriefcaseBusiness className="size-5" />
          </VNextMark>
          <div>
            <p className="vnext-kicker">New job</p>
            <h2 className="mt-1 font-display text-[23px] font-bold">Price request intake</h2>
            <p className="mt-1 text-[12px] text-vnext-muted">
              Start one record that will continue through estimating, installation, and completion.
            </p>
          </div>
        </header>
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
          <div className="sm:col-span-2">
            <Field label="Job / request name">
              <TextInput
                autoFocus
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Project name or address"
              />
            </Field>
          </div>
          <Field label="Customer">
            <Combobox
              options={companyOptions(companies)}
              value={form.customer_company_id}
              onChange={(value) => set("customer_company_id", value)}
              placeholder="Search customers…"
              onCreate={async (label) => {
                const company = await saveCompany.mutateAsync({
                  values: { name: label, kind: "customer" },
                });
                if (company) set("customer_company_id", company.id);
              }}
              createLabel="Add customer"
            />
          </Field>
          <Field label="Primary contact">
            <Combobox
              options={contactOptions(contacts, companies)}
              value={form.primary_contact_id}
              onChange={(value) => set("primary_contact_id", value)}
              placeholder="Search contacts…"
              onCreate={async (label) => {
                const contact = await saveContact.mutateAsync({
                  values: { full_name: label, company_id: form.customer_company_id },
                });
                if (contact) set("primary_contact_id", contact.id);
              }}
              createLabel="Add contact"
            />
          </Field>
          <Field label="Jobsite address">
            <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="General contractor">
            <Combobox
              options={companyOptions(companies)}
              value={form.gc_company_id}
              onChange={(value) => set("gc_company_id", value)}
              placeholder="Search companies…"
            />
          </Field>
          <Field label="Request source">
            <Select value={form.source} onChange={(e) => set("source", e.target.value)}>
              <option value="">Not set</option>
              <option>Customer</option>
              <option>General Contractor</option>
              <option>Designer</option>
              <option>Referral</option>
              <option>Repeat client</option>
            </Select>
          </Field>
          <Field label="Bid due">
            <TextInput
              type="date"
              value={form.bid_due_date}
              onChange={(e) => set("bid_due_date", e.target.value)}
            />
          </Field>
          <Field label="Follow-up">
            <TextInput
              type="date"
              value={form.follow_up_date}
              onChange={(e) => set("follow_up_date", e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Request and scope notes">
              <TextArea
                rows={4}
                value={form.intake_notes}
                onChange={(e) => set("intake_notes", e.target.value)}
                placeholder="Requested rooms, finish expectations, access, plan status, and anything the estimator should know."
              />
            </Field>
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-vnext-line bg-vnext-surface px-5 py-4 sm:px-7">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={form.name.trim().length < 2}
            loading={insert.isPending}
            onClick={() => void save()}
          >
            Create price request
          </Button>
        </footer>
      </div>
    </CenterDialog>
  );
}
