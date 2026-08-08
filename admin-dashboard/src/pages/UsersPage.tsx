import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { deleteAdminUser, listAdminUsers, updateAdminUser } from '../lib/api';
import type { PushPreferences, UserRecord, UserStatus } from '../lib/types';
import { Badge, Button, EmptyState, ErrorBanner, Input, Modal, PageCard, Select, Spinner, SuccessBanner } from '../components/Ui';

const STATUSES: UserStatus[] = ['active', 'suspended', 'deleted'];

type EditableUser = {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  status: UserStatus;
  pushNewVendor: boolean;
  pushExpiringDeal: boolean;
  pushLocalEvent: boolean;
  promoEmailOptIn: boolean;
  promoSmsOptIn: boolean;
};

function emptyEditable(): EditableUser {
  return {
    fullName: '',
    email: '',
    phone: '',
    city: '',
    status: 'active',
    pushNewVendor: false,
    pushExpiringDeal: false,
    pushLocalEvent: false,
    promoEmailOptIn: false,
    promoSmsOptIn: false,
  };
}

function fromUser(user: UserRecord): EditableUser {
  return {
    fullName: user.fullName ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    city: user.city ?? '',
    status: user.status,
    pushNewVendor: user.pushPreferences.newVendor,
    pushExpiringDeal: user.pushPreferences.expiringDeal,
    pushLocalEvent: user.pushPreferences.localEvent,
    promoEmailOptIn: user.promoEmailOptIn,
    promoSmsOptIn: user.promoSmsOptIn,
  };
}

function toUpdateBody(form: EditableUser): {
  fullName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: UserStatus;
  pushPreferences: PushPreferences;
  promoEmailOptIn: boolean;
  promoSmsOptIn: boolean;
} {
  return {
    fullName: form.fullName,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    city: form.city.trim() || null,
    status: form.status,
    pushPreferences: {
      newVendor: form.pushNewVendor,
      expiringDeal: form.pushExpiringDeal,
      localEvent: form.pushLocalEvent,
    },
    promoEmailOptIn: form.promoEmailOptIn,
    promoSmsOptIn: form.promoSmsOptIn,
  };
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusTone(status: UserStatus) {
  switch (status) {
    case 'active':
      return 'success';
    case 'suspended':
      return 'warning';
    case 'deleted':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<EditableUser>(emptyEditable());
  const [saving, setSaving] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const rows = await listAdminUsers({
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      });
      setUsers(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, [statusFilter, search]);

  function openEdit(user: UserRecord) {
    setEditing(user);
    setForm(fromUser(user));
    setSuccess(null);
    setError(null);
  }

  function closeEdit() {
    setEditing(null);
    setForm(emptyEditable());
  }

  function handleChange(field: keyof EditableUser, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAdminUser(editing.id, toUpdateBody(form));
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setSuccess('User updated');
      closeEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: UserRecord) {
    if (!window.confirm(`Delete ${user.fullName ?? user.email ?? user.id}?`)) return;
    setError(null);
    try {
      await deleteAdminUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setSuccess('User deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  }

  const filteredUsers = useMemo(() => users, [users]);

  return (
    <div className="stack">
      <PageCard title="User lookup" subtitle="View, edit and delete customer accounts.">
        {success && <SuccessBanner message={success} />}
        {error && <ErrorBanner message={error} />}

        <div className="filters" style={{ marginBottom: '1rem' }}>
          <Select value={statusFilter} onChange={(event: ChangeEvent<HTMLSelectElement>) => setStatusFilter(event.target.value as UserStatus | '')}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Input
            type="search"
            placeholder="Search name, email or phone"
            value={search}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
            style={{ minWidth: '16rem' }}
          />
          <Button variant="secondary" onClick={() => void loadUsers()} disabled={loading}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <Spinner />
        ) : filteredUsers.length === 0 ? (
          <EmptyState title="No users found" description="Try changing the filters or search terms." />
        ) : (
          <div className="vendor-list">
            {filteredUsers.map((user) => (
              <div key={user.id} className="list-row">
                <div className="vendor-info" style={{ minWidth: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="content-title-row">
                      <strong>{user.fullName}</strong>
                      <Badge tone={statusTone(user.status)}>{user.status}</Badge>
                    </div>
                    <p className="muted">
                      {user.email ?? '-'} · {user.phone ?? '-'} · {user.city ?? '-'}
                    </p>
                    <p className="muted">Joined {formatDate(user.createdAt)}</p>
                  </div>
                </div>
                <div className="row-actions">
                  <Button variant="secondary" onClick={() => openEdit(user)}>
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => void handleDelete(user)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageCard>

      <Modal open={editing !== null} title="Edit user" onClose={closeEdit}>
        <form onSubmit={handleSubmit} className="form">
          <div className="grid-2">
            <label>
              Full name
              <Input value={form.fullName} onChange={(event) => handleChange('fullName', event.target.value)} required />
            </label>
            <label>
              Status
              <Select value={form.status} onChange={(event) => handleChange('status', event.target.value as UserStatus)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <div className="grid-2">
            <label>
              Email
              <Input type="email" value={form.email} onChange={(event) => handleChange('email', event.target.value)} />
            </label>
            <label>
              Phone
              <Input type="tel" value={form.phone} onChange={(event) => handleChange('phone', event.target.value)} />
            </label>
          </div>

          <label>
            City
            <Input value={form.city} onChange={(event) => handleChange('city', event.target.value)} />
          </label>

          <fieldset>
            <legend>Push notifications</legend>
            <div className="checkbox-row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.pushNewVendor}
                  onChange={(event) => handleChange('pushNewVendor', event.target.checked)}
                />
                New vendor
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.pushExpiringDeal}
                  onChange={(event) => handleChange('pushExpiringDeal', event.target.checked)}
                />
                Expiring deal
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.pushLocalEvent}
                  onChange={(event) => handleChange('pushLocalEvent', event.target.checked)}
                />
                Local event
              </label>
            </div>
          </fieldset>

          <div className="checkbox-row">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.promoEmailOptIn}
                onChange={(event) => handleChange('promoEmailOptIn', event.target.checked)}
              />
              Promo emails
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.promoSmsOptIn}
                onChange={(event) => handleChange('promoSmsOptIn', event.target.checked)}
              />
              Promo SMS
            </label>
          </div>

          <div className="form-row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="ghost" type="button" onClick={closeEdit} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
