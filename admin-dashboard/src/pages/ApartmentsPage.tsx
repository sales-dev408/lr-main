import { useEffect, useState, type FormEvent } from 'react';
import { createAdminApartment, deleteAdminApartment, listAdminApartments, updateAdminApartment } from '../lib/api';
import type { ApartmentRecord } from '../lib/types';
import { Button, ErrorBanner, Input, PageCard, SuccessBanner } from '../components/Ui';

const mapboxToken = (import.meta.env as Record<string, string | undefined>).VITE_MAPBOX_ACCESS_TOKEN;

async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  if (!mapboxToken || !address.trim()) return null;
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&limit=1`,
  );
  if (!response.ok) return null;
  const data = (await response.json()) as { features?: Array<{ center: [number, number] }> };
  const feature = data.features?.[0];
  if (!feature?.center) return null;
  const [longitude, latitude] = feature.center;
  return { latitude, longitude };
}

const blankApartment: Omit<ApartmentRecord, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  section: '',
  station: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  phone: '',
  website: '',
  latitude: null,
  longitude: null,
  near_rail: false,
  distance_miles: null,
};

export function ApartmentsPage() {
  const [apartments, setApartments] = useState<ApartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(blankApartment);
  const [editing, setEditing] = useState<ApartmentRecord | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminApartments();
      setApartments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load apartments');
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(field: keyof ApartmentRecord, value: string) {
    if (editing) {
      setEditing({ ...editing, [field]: value });
    } else {
      setForm({ ...form, [field]: value });
    }
  }

  function handleNumberChange(field: 'latitude' | 'longitude', value: string) {
    const num = value.trim() ? Number(value) : null;
    if (editing) {
      setEditing({ ...editing, [field]: num });
    } else {
      setForm({ ...form, [field]: num });
    }
  }

  async function handleGeocode() {
    const address = editing ? [editing.address, editing.city, editing.state, editing.zip].filter(Boolean).join(', ') : [form.address, form.city, form.state, form.zip].filter(Boolean).join(', ');
    const coords = await geocodeAddress(address);
    if (!coords) {
      setError('Unable to look up coordinates. Check the address and Mapbox token.');
      return;
    }
    if (editing) {
      setEditing({ ...editing, latitude: coords.latitude, longitude: coords.longitude });
    } else {
      setForm({ ...form, latitude: coords.latitude, longitude: coords.longitude });
    }
    setError(null);
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setError(null);
    setToast(null);
    try {
      await createAdminApartment({
        ...form,
        section: form.section || null,
        station: form.station || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        phone: form.phone || null,
        website: form.website || null,
      });
      setForm(blankApartment);
      setToast('Apartment created.');
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
      await updateAdminApartment(editing.id, {
        ...editing,
        section: editing.section || null,
        station: editing.station || null,
        address: editing.address || null,
        city: editing.city || null,
        state: editing.state || null,
        zip: editing.zip || null,
        phone: editing.phone || null,
        website: editing.website || null,
      });
      setEditing(null);
      setToast('Apartment updated.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this listing?')) return;
    setError(null);
    try {
      await deleteAdminApartment(id);
      setToast('Apartment deleted.');
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
            Section
            <Input value={data.section ?? ''} onChange={(e) => handleInputChange('section', e.target.value)} placeholder="e.g. North Phoenix" />
          </label>
          <label>
            Station
            <Input value={data.station ?? ''} onChange={(e) => handleInputChange('station', e.target.value)} placeholder="e.g. Camelback/7th Ave" />
          </label>
        </div>
        <label>
          Address
          <Input value={data.address ?? ''} onChange={(e) => handleInputChange('address', e.target.value)} />
        </label>
        <div className="grid-2">
          <label>
            City
            <Input value={data.city ?? ''} onChange={(e) => handleInputChange('city', e.target.value)} />
          </label>
          <label>
            State / ZIP
            <Input value={`${data.state ?? ''} ${data.zip ?? ''}`.trim()} onChange={(e) => {
              const parts = e.target.value.trim().split(/\s+/);
              handleInputChange('state', parts[0] ?? '');
              handleInputChange('zip', parts.slice(1).join(' '));
            }} />
          </label>
        </div>
        <div className="grid-2">
          <label>
            Phone
            <Input value={data.phone ?? ''} onChange={(e) => handleInputChange('phone', e.target.value)} />
          </label>
          <label>
            Website
            <Input value={data.website ?? ''} onChange={(e) => handleInputChange('website', e.target.value)} />
          </label>
        </div>
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
        <Button type="button" variant="secondary" onClick={handleGeocode} disabled={!mapboxToken}>
          Geocode address
        </Button>
        <div className="inline-row">
          <Button type="submit" disabled={isEdit ? false : creating}>
            {isEdit ? 'Update listing' : creating ? 'Creating…' : 'Create listing'}
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
          <h1>Apartments / Hotels</h1>
          <p className="muted">Manage apartment and hotel listings near the light rail.</p>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {toast ? <SuccessBanner message={toast} /> : null}

      <div className="grid-2">
        <PageCard title="Add listing" subtitle="Create a new apartment or hotel record.">
          {renderForm(false)}
        </PageCard>

        <PageCard title="Listings" subtitle={`${apartments.length} record${apartments.length === 1 ? '' : 's'}`}>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : apartments.length === 0 ? (
            <p className="muted">No listings yet.</p>
          ) : (
            <div className="vendor-list">
              {apartments.map((apt) => (
                <article key={apt.id} className="list-row">
                  <div>
                    <strong>{apt.name}</strong>
                    <p className="muted">{[apt.station, apt.address, apt.city].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="row-actions">
                    <Button variant="secondary" onClick={() => setEditing(apt)}>Edit</Button>
                    <Button variant="danger" onClick={() => void handleDelete(apt.id)}>Delete</Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </PageCard>
      </div>

      {editing ? (
        <PageCard title="Edit listing" subtitle={editing.name}>
          {renderForm(true)}
        </PageCard>
      ) : null}
    </div>
  );
}
