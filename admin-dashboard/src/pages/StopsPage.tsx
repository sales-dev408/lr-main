import { useEffect, useState, type FormEvent } from 'react';
import { createAdminStop, deleteAdminStop, listAdminStops, updateAdminStop } from '../lib/api';
import type { StopRecord } from '../lib/types';
import { Button, ErrorBanner, Input, PageCard, SuccessBanner } from '../components/Ui';

const blankStop: Omit<StopRecord, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  city: '',
  line: '',
  position: null,
  latitude: null,
  longitude: null,
};

export function StopsPage() {
  const [stops, setStops] = useState<StopRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(blankStop);
  const [editing, setEditing] = useState<StopRecord | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminStops();
      setStops(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load stops');
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(field: 'name' | 'city' | 'line', value: string) {
    if (editing) {
      setEditing({ ...editing, [field]: value });
    } else {
      setForm({ ...form, [field]: value });
    }
  }

  function handleNumberChange(field: 'position' | 'latitude' | 'longitude', value: string) {
    const num = value.trim() ? Number(value) : null;
    if (editing) {
      setEditing({ ...editing, [field]: num });
    } else {
      setForm({ ...form, [field]: num });
    }
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setError(null);
    setToast(null);
    try {
      await createAdminStop({
        ...form,
        city: form.city || null,
        line: form.line || null,
      });
      setForm(blankStop);
      setToast('Stop created.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  async function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setError(null);
    setToast(null);
    try {
      await updateAdminStop(editing.id, {
        ...editing,
        city: editing.city || null,
        line: editing.line || null,
      });
      setEditing(null);
      setToast('Stop updated.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this stop?')) return;
    setError(null);
    try {
      await deleteAdminStop(id);
      setToast('Stop deleted.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  function renderForm(isEdit: boolean) {
    const data = isEdit ? editing! : form;
    return (
      <form className="form" onSubmit={isEdit ? submitUpdate : submitCreate}>
        <label>
          Name
          <Input value={data.name} onChange={(e) => handleInputChange('name', e.target.value)} required />
        </label>
        <div className="grid-2">
          <label>
            City
            <Input value={data.city ?? ''} onChange={(e) => handleInputChange('city', e.target.value)} />
          </label>
          <label>
            Line
            <Input value={data.line ?? ''} onChange={(e) => handleInputChange('line', e.target.value)} placeholder="e.g. A Line" />
          </label>
        </div>
        <label>
          Position
          <Input type="number" step="1" value={data.position ?? ''} onChange={(e) => handleNumberChange('position', e.target.value)} />
        </label>
        <div className="grid-2">
          <label>
            Latitude
            <Input type="number" step="any" value={data.latitude ?? ''} onChange={(e) => handleNumberChange('latitude', e.target.value)} />
          </label>
          <label>
            Longitude
            <Input type="number" step="any" value={data.longitude ?? ''} onChange={(e) => handleNumberChange('longitude', e.target.value)} />
          </label>
        </div>
        <div className="inline-row">
          <Button type="submit" disabled={isEdit ? false : creating}>
            {isEdit ? 'Update stop' : creating ? 'Creating…' : 'Create stop'}
          </Button>
          {isEdit ? <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button> : null}
        </div>
      </form>
    );
  }

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Stops</h1>
          <p className="muted">Manage light rail stops for vendors and apartments.</p>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {toast ? <SuccessBanner message={toast} /> : null}

      <div className="grid-2">
        <PageCard title="Add stop" subtitle="Create a new rail stop.">
          {renderForm(false)}
        </PageCard>

        <PageCard title="Stops" subtitle={`${stops.length} stop${stops.length === 1 ? '' : 's'}`}>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : stops.length === 0 ? (
            <p className="muted">No stops yet.</p>
          ) : (
            <div className="vendor-list">
              {stops.map((stop) => (
                <article key={stop.id} className="list-row">
                  <div>
                    <strong>{stop.name}</strong>
                    <p className="muted">{[stop.line, stop.city].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="row-actions">
                    <Button variant="secondary" onClick={() => setEditing(stop)}>Edit</Button>
                    <Button variant="danger" onClick={() => void handleDelete(stop.id)}>Delete</Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </PageCard>
      </div>

      {editing ? (
        <PageCard title="Edit stop" subtitle={editing.name}>
          {renderForm(true)}
        </PageCard>
      ) : null}
    </div>
  );
}
