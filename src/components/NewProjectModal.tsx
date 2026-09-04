import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
  profileOptions,
  useCompanies,
  useContacts,
  useProfiles,
  useSaveCompany,
  useSaveContact,
} from "@/lib/people";

const TYPES = ["New Job", "Existing Client", "Commercial", "Warranty / Return"];
const SOURCES = ["Referral", "Repeat client", "GC invite", "Walk-in", "Website", "Other"];

const EMPTY = {
  name: "",
  address: "",
  project_type: "New Job",
  source: "Referral",
  customer_company_id: null as string | null,
  gc_company_id: null as string | null,
  primary_contact_id: null as string | null,
  salesperson_user_id: null as string | null,
  estimator_user_id: null as string | null,
  bid_due_date: "",
  intake_notes: "",
};

export function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const insert = useInsertRow("projects");
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const { data: companies = [] } = useCompanies();
  const { data: contacts = [] } = useContacts();
  const { data: profiles = [] } = useProfiles();
  const saveCompany = useSaveCompany();
  const saveContact = useSaveContact();
  const [form, setForm] = useState(EMPTY);
  const [more, setMore] = useState(false);

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
      salesperson_user_id: form.salesperson_user_id,
      estimator_user_id: form.estimator_user_id,
      bid_due_date: form.bid_due_date || null,
      intake_notes: form.intake_notes || null,
      created_by: user?.id ?? null,
      lifecycle_stage: "New Submission",
    })) as { id: string } | null;
    onClose();
    setForm(EMPTY);
    setMore(false);
    if (row?.id) navigate({ to: "/projects/$projectId", params: { projectId: row.id } });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New lead"
      subtitle="Capture only what is known today. Everything else is filled in as the job moves through its lifecycle."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={insert.isPending}
            disabled={!valid}
            {...(!valid ? { disabledReason: "Enter a job name or address" } : {})}
            onClick={save}
          >
            Create lead
          </Button>
        </>
      }
    >
      <InfoBanner>
        New leads start at <strong>New Submission</strong>. Only the job name is required.
      </InfoBanner>

      <Field label="Job name / address">
        <TextInput
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="118 Park Place"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Job type">
          <Select value={form.project_type} onChange={(e) => set("project_type", e.target.value)}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Customer" hint="Type a new name to add it">
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

      <button
        type="button"
        onClick={() => setMore((m) => !m)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-[12.5px] font-semibold text-secondary-foreground transition-colors hover:border-border-strong"
      >
        Optional detail — address, GC, contact, owners, notes
        <ChevronDown className={cn("size-4 transition-transform", more && "rotate-180")} />
      </button>

      {more ? (
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Full address" hint="Optional">
              <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <Field label="How did it come in?">
              <Select value={form.source} onChange={(e) => set("source", e.target.value)}>
                {SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
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
            <Field label="Main contact" hint="Optional">
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
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Salesperson">
              <Combobox
                options={profileOptions(profiles)}
                value={form.salesperson_user_id}
                onChange={(next) => set("salesperson_user_id", next)}
                placeholder="Search employees…"
              />
            </Field>
            <Field label="Estimator">
              <Combobox
                options={profileOptions(profiles)}
                value={form.estimator_user_id}
                onChange={(next) => set("estimator_user_id", next)}
                placeholder="Search employees…"
              />
            </Field>
            <Field label="Bid due date" hint="Optional">
              <TextInput
                type="date"
                value={form.bid_due_date}
                onChange={(e) => set("bid_due_date", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Intake notes" hint="Anything said on the call">
            <TextArea
              rows={3}
              value={form.intake_notes}
              onChange={(e) => set("intake_notes", e.target.value)}
              placeholder="Two bathrooms plus kitchen backsplash. Wants large format porcelain."
            />
          </Field>
        </div>
      ) : null}
    </Modal>
  );
}
