import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/PageShell";
import {
  Avatar,
  Button,
  Checkbox,
  Combobox,
  EmptyState,
  Field,
  InfoBanner,
  Modal,
  SectionCard,
  Select,
  Table,
  TableSkeleton,
  Td,
  TextArea,
  TextInput,
  Th,
  UnderlineTabs,
} from "@/components/kit";
import { ROLE_LABELS, usePermissions, type AppRole, type Profile } from "@/hooks/useAuth";
import {
  COMPANY_KINDS,
  COMPANY_KIND_LABELS,
  companyOptions,
  useCompanies,
  useContacts,
  useProfiles,
  useSaveCompany,
  useSaveContact,
  useSaveProfile,
  useToggleRole,
  useUserRoles,
  type Company,
  type Contact,
} from "@/lib/people";
import { useCrews, useInsertRow, useUpdateRow } from "@/lib/data";
import { inviteEmployee } from "@/lib/employees.functions";

const TABS = ["Users & roles", "Companies", "Contacts", "Crews"] as const;
const ROLE_ORDER: AppRole[] = [
  "admin",
  "gm",
  "sales",
  "estimator",
  "pm",
  "site_manager",
  "office_coordinator",
  "accounting",
  "installer",
  "viewer",
];

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Cobblestone Tile OS" },
      {
        name: "description",
        content: "Manage employees, roles, customer companies, contacts and install crews.",
      },
      { property: "og:title", content: "Settings — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Manage employees, roles, customer companies, contacts and install crews.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [tab, setTab] = useState<string>(TABS[0]);
  const [invitingTop, setInvitingTop] = useState(false);
  const perms = usePermissions();

  return (
    <PageShell
      crumbs={[{ label: "Settings" }]}
      title="Settings"
      subtitle="People, roles, companies, contacts and crews — the libraries every other screen selects from."
      actions={
        perms.canManageUsers ? (
          <Button
            variant="primary"
            onClick={() => {
              setTab("Users & roles");
              setInvitingTop(true);
            }}
          >
            <UserPlus className="size-4" /> Invite employee
          </Button>
        ) : undefined
      }
    >
      <UnderlineTabs
        items={TABS.map((t) => ({ value: t, label: t }))}
        value={tab}
        onChange={setTab}
      />
      {!perms.canManageLibraries ? (
        <InfoBanner>
          You can view these libraries. Company, contact and crew maintenance is limited to
          Administrators, the General Manager and Office Coordinators. Employee access is
          Administrator-only.
        </InfoBanner>
      ) : null}
      {tab === "Users & roles" ? (
        <UsersTab
          canEdit={perms.canManageUsers}
          inviting={invitingTop}
          onInvitingChange={setInvitingTop}
        />
      ) : null}
      {tab === "Companies" ? <CompaniesTab canEdit={perms.canManageLibraries} /> : null}
      {tab === "Contacts" ? <ContactsTab canEdit={perms.canManageLibraries} /> : null}
      {tab === "Crews" ? <CrewsTab canEdit={perms.canManageLibraries} /> : null}
    </PageShell>
  );
}

/* ------------------------------- Users & roles ------------------------------- */

function UsersTab({
  canEdit,
  inviting: invitingProp = false,
  onInvitingChange,
}: {
  canEdit: boolean;
  inviting?: boolean;
  onInvitingChange?: (open: boolean) => void;
}) {
  const { data: profiles = [], isLoading } = useProfiles();
  const { data: roleRows = [] } = useUserRoles();
  const toggleRole = useToggleRole();
  const [editing, setEditing] = useState<Profile | null>(null);
  const [invitingLocal, setInvitingLocal] = useState(false);
  const inviting = invitingProp || invitingLocal;
  const setInviting = (open: boolean) => {
    setInvitingLocal(open);
    onInvitingChange?.(open);
  };

  const rolesByUser = useMemo(() => {
    const map = new Map<string, AppRole[]>();
    roleRows.forEach((r) => map.set(r.user_id, [...(map.get(r.user_id) ?? []), r.role]));
    return map;
  }, [roleRows]);

  return (
    <>
      <SectionCard
        title="Employees"
        subtitle="Every person who signs in. Roles decide what they can see and change."
        actions={
          canEdit ? (
            <Button variant="primary" onClick={() => setInviting(true)}>
              <Plus className="size-3.5" /> Invite employee
            </Button>
          ) : undefined
        }
      >
        {isLoading ? (
          <TableSkeleton cols={4} />
        ) : profiles.length === 0 ? (
          <EmptyState
            title="No employees yet"
            note="People appear here the first time they sign in with their work email."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Job title</Th>
                <Th>Roles</Th>
                <Th align="right">{canEdit ? "Edit" : ""}</Th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const roles = rolesByUser.get(p.user_id) ?? [];
                return (
                  <tr
                    key={p.user_id}
                    className={canEdit ? "cursor-pointer" : undefined}
                    onClick={canEdit ? () => setEditing(p) : undefined}
                  >
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={p.initials} tone={p.avatar_tone} />
                        <div>
                          <div className="font-semibold">{p.full_name || "Unnamed"}</div>
                          <div className="text-[12px] text-muted-foreground">{p.email}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>{p.job_title || "—"}</Td>
                    <Td>
                      {roles.length === 0 ? (
                        <span className="text-warning">No role assigned</span>
                      ) : (
                        roles.map((r) => ROLE_LABELS[r]).join(", ")
                      )}
                    </Td>
                    <Td align="right">
                      {canEdit ? (
                        <Pencil className="ml-auto size-3.5 text-muted-foreground" />
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </SectionCard>

      {editing ? (
        <UserModal
          profile={editing}
          roles={rolesByUser.get(editing.user_id) ?? []}
          onToggleRole={(role, grant) =>
            toggleRole.mutate({ userId: editing.user_id, role, grant })
          }
          onClose={() => setEditing(null)}
        />
      ) : null}
      <InviteEmployeeModal open={inviting} onClose={() => setInviting(false)} />
    </>
  );
}

function InviteEmployeeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ fullName: "", email: "", role: "viewer" as AppRole });
  const invite = useMutation({
    mutationFn: () => inviteEmployee({ data: form }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
      void queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      toast.success("Employee invitation sent");
      setForm({ fullName: "", email: "", role: "viewer" });
      onClose();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Invitation failed"),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite employee"
      subtitle="Creates a controlled employee account and sends a secure sign-in invitation."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={invite.isPending}
            disabled={!form.fullName.trim() || !form.email.trim()}
            onClick={() => invite.mutate()}
          >
            Send invitation
          </Button>
        </>
      }
    >
      <Field label="Full name">
        <TextInput
          value={form.fullName}
          onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
        />
      </Field>
      <Field label="Work email">
        <TextInput
          type="email"
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
        />
      </Field>
      <Field label="Initial role">
        <Select
          value={form.role}
          onChange={(event) =>
            setForm((current) => ({ ...current, role: event.target.value as AppRole }))
          }
        >
          {ROLE_ORDER.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}

function UserModal({
  profile,
  roles,
  onToggleRole,
  onClose,
}: {
  profile: Profile;
  roles: AppRole[];
  onToggleRole: (role: AppRole, grant: boolean) => void;
  onClose: () => void;
}) {
  const save = useSaveProfile();
  const [form, setForm] = useState({
    full_name: profile.full_name ?? "",
    initials: profile.initials ?? "",
    job_title: profile.job_title ?? "",
    phone: profile.phone ?? "",
    is_active: profile.is_active,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={profile.full_name || profile.email || "Employee"}
      subtitle="Details and role assignments."
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            onClick={async () => {
              await save.mutateAsync({
                userId: profile.user_id,
                values: {
                  full_name: form.full_name.trim(),
                  initials: (form.initials || form.full_name.slice(0, 2)).toUpperCase(),
                  job_title: form.job_title || null,
                  phone: form.phone || null,
                  is_active: form.is_active,
                },
              });
              onClose();
            }}
          >
            Save details
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Full name">
          <TextInput
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          />
        </Field>
        <Field label="Initials">
          <TextInput
            value={form.initials}
            maxLength={3}
            onChange={(e) => setForm((f) => ({ ...f, initials: e.target.value }))}
          />
        </Field>
        <Field label="Job title">
          <TextInput
            value={form.job_title}
            onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
          />
        </Field>
        <Field label="Phone">
          <TextInput
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </Field>
      </div>
      <Checkbox
        checked={form.is_active}
        onChange={(next) => setForm((f) => ({ ...f, is_active: next }))}
        label="Active employee"
      />
      <div className="mt-2 border-t border-border pt-4">
        <div className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
          Roles
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {ROLE_ORDER.map((role) => (
            <Checkbox
              key={role}
              checked={roles.includes(role)}
              onChange={(next) => onToggleRole(role, next)}
              label={ROLE_LABELS[role]}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------- Companies --------------------------------- */

const EMPTY_COMPANY = {
  name: "",
  kind: "customer",
  phone: "",
  email: "",
  address: "",
  website: "",
  notes: "",
  is_active: true,
};

function CompaniesTab({ canEdit }: { canEdit: boolean }) {
  const { data: companies = [], isLoading } = useCompanies();
  const [editing, setEditing] = useState<Company | "new" | null>(null);

  return (
    <>
      <SectionCard
        title="Companies"
        subtitle="Customers, general contractors, designers, suppliers and installers."
        actions={
          canEdit ? (
            <Button variant="primary" onClick={() => setEditing("new")}>
              <Plus className="size-3.5" /> New company
            </Button>
          ) : undefined
        }
      >
        {isLoading ? (
          <TableSkeleton cols={4} />
        ) : companies.length === 0 ? (
          <EmptyState
            title="No companies yet"
            note="Add the customers, GCs and suppliers you work with so they can be selected on jobs."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>Type</Th>
                <Th>Phone</Th>
                <Th>Email</Th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr
                  key={c.id}
                  className={canEdit ? "cursor-pointer" : undefined}
                  onClick={canEdit ? () => setEditing(c) : undefined}
                >
                  <Td>
                    <span className="font-semibold">{c.name}</span>
                    {!c.is_active ? (
                      <span className="ml-2 text-[12px] text-muted-foreground">inactive</span>
                    ) : null}
                  </Td>
                  <Td>{COMPANY_KIND_LABELS[c.kind] ?? c.kind}</Td>
                  <Td>{c.phone || "—"}</Td>
                  <Td>{c.email || "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      {editing ? (
        <CompanyModal
          company={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function CompanyModal({ company, onClose }: { company: Company | null; onClose: () => void }) {
  const save = useSaveCompany();
  const [form, setForm] = useState({
    ...EMPTY_COMPANY,
    ...(company
      ? {
          name: company.name,
          kind: company.kind,
          phone: company.phone ?? "",
          email: company.email ?? "",
          address: company.address ?? "",
          website: company.website ?? "",
          notes: company.notes ?? "",
          is_active: company.is_active,
        }
      : {}),
  });
  const valid = form.name.trim().length > 1;

  return (
    <Modal
      open
      onClose={onClose}
      title={company ? company.name : "New company"}
      subtitle="Companies are selected on jobs, POs and work items."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!valid}
            {...(!valid ? { disabledReason: "Enter a company name" } : {})}
            onClick={async () => {
              await save.mutateAsync({
                ...(company ? { id: company.id } : {}),
                values: {
                  name: form.name.trim(),
                  kind: form.kind,
                  phone: form.phone || null,
                  email: form.email || null,
                  address: form.address || null,
                  website: form.website || null,
                  notes: form.notes || null,
                  is_active: form.is_active,
                },
              });
              onClose();
            }}
          >
            Save company
          </Button>
        </>
      }
    >
      <Field label="Company name">
        <TextInput
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Park Place Development"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Type">
          <Select
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
          >
            {COMPANY_KINDS.map((k) => (
              <option key={k} value={k}>
                {COMPANY_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Phone">
          <TextInput
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </Field>
        <Field label="Email">
          <TextInput
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </Field>
        <Field label="Website">
          <TextInput
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
          />
        </Field>
      </div>
      <Field label="Address">
        <TextInput
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />
      </Field>
      <Field label="Notes" hint="Optional">
        <TextArea
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </Field>
      <Checkbox
        checked={form.is_active}
        onChange={(next) => setForm((f) => ({ ...f, is_active: next }))}
        label="Active"
      />
    </Modal>
  );
}

/* --------------------------------- Contacts --------------------------------- */

function ContactsTab({ canEdit }: { canEdit: boolean }) {
  const { data: contacts = [], isLoading } = useContacts();
  const { data: companies = [] } = useCompanies();
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const companyName = (id: string | null) =>
    id ? (companies.find((c) => c.id === id)?.name ?? "—") : "—";

  return (
    <>
      <SectionCard
        title="Contacts"
        subtitle="People outside the company — the ones a job can be waiting on."
        actions={
          canEdit ? (
            <Button variant="primary" onClick={() => setEditing("new")}>
              <Plus className="size-3.5" /> New contact
            </Button>
          ) : undefined
        }
      >
        {isLoading ? (
          <TableSkeleton cols={4} />
        ) : contacts.length === 0 ? (
          <EmptyState
            title="No contacts yet"
            note="Add site contacts, GC project managers and supplier reps."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Contact</Th>
                <Th>Company</Th>
                <Th>Phone</Th>
                <Th>Email</Th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr
                  key={c.id}
                  className={canEdit ? "cursor-pointer" : undefined}
                  onClick={canEdit ? () => setEditing(c) : undefined}
                >
                  <Td>
                    <span className="font-semibold">{c.full_name}</span>
                    {c.title ? (
                      <span className="ml-2 text-[12px] text-muted-foreground">{c.title}</span>
                    ) : null}
                  </Td>
                  <Td>{companyName(c.company_id)}</Td>
                  <Td>{c.phone || "—"}</Td>
                  <Td>{c.email || "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      {editing ? (
        <ContactModal
          contact={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function ContactModal({ contact, onClose }: { contact: Contact | null; onClose: () => void }) {
  const save = useSaveContact();
  const { data: companies = [] } = useCompanies();
  const saveCompany = useSaveCompany();
  const [form, setForm] = useState({
    full_name: contact?.full_name ?? "",
    company_id: contact?.company_id ?? null,
    title: contact?.title ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    notes: contact?.notes ?? "",
    is_active: contact?.is_active ?? true,
  });
  const valid = form.full_name.trim().length > 1;

  return (
    <Modal
      open
      onClose={onClose}
      title={contact ? contact.full_name : "New contact"}
      subtitle="Contacts can own an outstanding answer on any job."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!valid}
            {...(!valid ? { disabledReason: "Enter a contact name" } : {})}
            onClick={async () => {
              await save.mutateAsync({
                ...(contact ? { id: contact.id } : {}),
                values: {
                  full_name: form.full_name.trim(),
                  company_id: form.company_id,
                  title: form.title || null,
                  phone: form.phone || null,
                  email: form.email || null,
                  notes: form.notes || null,
                  is_active: form.is_active,
                },
              });
              onClose();
            }}
          >
            Save contact
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Full name">
          <TextInput
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          />
        </Field>
        <Field label="Title / role">
          <TextInput
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Site super"
          />
        </Field>
      </div>
      <Field label="Company" hint="Search, or type a new name to add it">
        <Combobox
          options={companyOptions(companies)}
          value={form.company_id}
          onChange={(next) => setForm((f) => ({ ...f, company_id: next }))}
          placeholder="Search companies…"
          onCreate={async (label) => {
            await saveCompany.mutateAsync({ values: { name: label, kind: "other" } });
          }}
          createLabel="Add company"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Phone">
          <TextInput
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </Field>
        <Field label="Email">
          <TextInput
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </Field>
      </div>
      <Field label="Notes" hint="Optional">
        <TextArea
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </Field>
      <Checkbox
        checked={form.is_active}
        onChange={(next) => setForm((f) => ({ ...f, is_active: next }))}
        label="Active"
      />
    </Modal>
  );
}

/* ----------------------------------- Crews ----------------------------------- */

const TONES = ["blue", "green", "amber", "neutral"];

function CrewsTab({ canEdit }: { canEdit: boolean }) {
  const { data: crews = [], isLoading } = useCrews();
  const insert = useInsertRow("crews");
  const update = useUpdateRow("crews");
  const [open, setOpen] = useState<null | {
    id?: string;
    name: string;
    initials: string;
    tone: string;
  }>(null);

  return (
    <>
      <SectionCard
        title="Install crews"
        subtitle="Crew lanes on the weekly schedule."
        actions={
          canEdit ? (
            <Button
              variant="primary"
              onClick={() => setOpen({ name: "", initials: "", tone: "blue" })}
            >
              <Plus className="size-3.5" /> New crew
            </Button>
          ) : undefined
        }
      >
        {isLoading ? (
          <TableSkeleton cols={3} />
        ) : crews.length === 0 ? (
          <EmptyState title="No crews yet" note="Add crews to build the weekly schedule." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Crew</Th>
                <Th>Initials</Th>
                <Th>Lane</Th>
              </tr>
            </thead>
            <tbody>
              {crews.map((c) => (
                <tr
                  key={c.id}
                  className={canEdit ? "cursor-pointer" : undefined}
                  onClick={
                    canEdit
                      ? () =>
                          setOpen({
                            id: c.id,
                            name: c.name,
                            initials: c.initials,
                            tone: c.tone,
                          })
                      : undefined
                  }
                >
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={c.initials} tone={c.tone} />
                      <span className="font-semibold">{c.name}</span>
                    </div>
                  </Td>
                  <Td>{c.initials}</Td>
                  <Td>{c.is_open_lane ? "Unassigned lane" : "Crew lane"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      {open ? (
        <Modal
          open
          onClose={() => setOpen(null)}
          title={open.id ? open.name || "Crew" : "New crew"}
          subtitle="Crews appear as lanes on the weekly schedule."
          footer={
            <>
              <Button onClick={() => setOpen(null)}>Cancel</Button>
              <Button
                variant="primary"
                loading={insert.isPending || update.isPending}
                disabled={open.name.trim().length < 2}
                {...(open.name.trim().length < 2 ? { disabledReason: "Enter a crew name" } : {})}
                onClick={async () => {
                  const values = {
                    name: open.name.trim(),
                    initials: (open.initials || open.name.slice(0, 2)).toUpperCase(),
                    tone: open.tone,
                  };
                  if (open.id) await update.mutateAsync({ id: open.id, patch: values });
                  else await insert.mutateAsync(values);
                  setOpen(null);
                }}
              >
                Save crew
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-3 gap-3.5">
            <div className="col-span-2">
              <Field label="Crew name">
                <TextInput
                  value={open.name}
                  onChange={(e) => setOpen((o) => (o ? { ...o, name: e.target.value } : o))}
                  placeholder="Philip"
                />
              </Field>
            </div>
            <Field label="Initials">
              <TextInput
                value={open.initials}
                maxLength={3}
                onChange={(e) => setOpen((o) => (o ? { ...o, initials: e.target.value } : o))}
              />
            </Field>
          </div>
          <Field label="Lane colour">
            <Select
              value={open.tone}
              onChange={(e) => setOpen((o) => (o ? { ...o, tone: e.target.value } : o))}
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </Modal>
      ) : null}
    </>
  );
}
