import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FolderCheck } from "lucide-react";
import {
  Button,
  Combobox,
  Field,
  InfoBanner,
  Modal,
  Select,
  TextArea,
  TextInput,
} from "@/components/kit";
import { useInsertRow } from "@/lib/data";
import { useAuthUser } from "@/hooks/useAuth";
import {
  companyOptions,
  contactOptions,
  useCompanies,
  useContacts,
  useSaveCompany,
  useSaveContact,
} from "@/lib/people";

const TYPES = ["New Job", "Existing Client", "Commercial", "Warranty / Return"];
const EMPTY = {
  name: "",
  address: "",
  project_type: "New Job",
  source: null as string | null,
  customer_company_id: null as string | null,
  gc_company_id: null as string | null,
  primary_contact_id: null as string | null,
  pm_user_id: null as string | null,
  target_date: "",
  intake_notes: "",
};

export function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const insert = useInsertRow("projects");
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const { data: companies = [] } = useCompanies();
  const { data: contacts = [] } = useContacts();
  const saveCompany = useSaveCompany();
  const saveContact = useSaveContact();
  const [form, setForm] = useState(EMPTY);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const valid = form.name.trim().length > 1;

  const save = async () => {
    if (!valid) return;
    const row = (await insert.mutateAsync({
      name: form.name.trim(),
      address: form.address || null,
      project_type: form.project_type,
      source: form.source,
      customer_company_id: form.customer_company_id,
      gc_company_id: form.gc_company_id,
      primary_contact_id: form.primary_contact_id,
      pm_user_id: form.pm_user_id,
      target_date: form.target_date || null,
      intake_notes: form.intake_notes || null,
      created_by: user?.id ?? null,
      lifecycle_stage: "Setup",
    })) as { id: string } | null;
    onClose();
    setForm(EMPTY);
    if (row?.id) navigate({ to: "/projects/$projectId", params: { projectId: row.id } });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Approved Job Setup"
      subtitle="Create the operating record and start office setup."
      width="max-w-[760px]"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={insert.isPending}
            disabled={!valid}
            {...(!valid ? { disabledReason: "Enter a project name" } : {})}
            onClick={save}
          >
            Create project
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-xl border border-primary/20 bg-primary-soft/55 p-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-card)]">
          <FolderCheck className="size-5" />
        </span>
        <InfoBanner>
          This creates an approved project directly in <strong>Setup</strong>. Add only confirmed
          job facts.
        </InfoBanner>
      </div>

      <Field label="Project name">
        <TextInput
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="118 Park Place Renovation"
        />
      </Field>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Project type">
          <Select value={form.project_type} onChange={(e) => set("project_type", e.target.value)}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Customer" hint="Search or add a company">
          <Combobox
            options={companyOptions(companies)}
            value={form.customer_company_id}
            onChange={(next) => set("customer_company_id", next)}
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
      </div>

      <div className="grid gap-3.5 rounded-xl border border-border bg-muted/25 p-4 sm:grid-cols-2">
        <Field label="Jobsite address" hint="Optional">
          <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="General contractor" hint="Optional">
          <Combobox
            options={companyOptions(companies)}
            value={form.gc_company_id}
            onChange={(next) => set("gc_company_id", next)}
            placeholder="Search companies…"
            onCreate={async (label) => {
              const company = await saveCompany.mutateAsync({
                values: { name: label, kind: "gc" },
              });
              if (company) set("gc_company_id", company.id);
            }}
            createLabel="Add company"
          />
        </Field>
        <Field label="Primary contact" hint="Optional">
          <Combobox
            options={contactOptions(contacts, companies)}
            value={form.primary_contact_id}
            onChange={(next) => set("primary_contact_id", next)}
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
        <Field label="Target date" hint="Optional">
          <TextInput
            type="date"
            value={form.target_date}
            onChange={(e) => set("target_date", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Setup notes" hint="Scope, access, or handoff facts already confirmed">
        <TextArea
          rows={3}
          value={form.intake_notes}
          onChange={(e) => set("intake_notes", e.target.value)}
          placeholder="Two bathrooms and kitchen backsplash. Plans received from GC."
        />
      </Field>
    </Modal>
  );
}
