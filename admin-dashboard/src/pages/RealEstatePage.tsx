import { useEffect, useState, type FormEvent } from 'react';
import { createAdminRealEstate, deleteAdminRealEstate, listAdminRealEstate, listAdminStops, updateAdminRealEstate } from '../lib/api';
import type { RealEstateRecord, StopRecord } from '../lib/types';
import { Button, ErrorBanner, Input, PageCard, Select, SuccessBanner } from '../components/Ui';

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

const blankListing: Omit<RealEstateRecord, 'id' | 'created_at' | 'updated_at'> = {
  title: '',
  description: '',
  price: null,
  beds: null,
  baths: null,
  sqft: null,
  property_type: 'house',
  listing_status: 'for_sale',
  address: '',
  city: '',
  state: '',
  zip: '',
  phone: '',
  email: '',
  website: '',
  image_url: '',
  station: '',
  latitude: null,
  longitude: null,
  active: true,
};

const PROPERTY_TYPES = ['house', 'condo', 'townhouse', 'apartment', 'land', 'commercial'];
const LISTING_STATUSES = [
  { value: 'for_sale', label: 'For Sale' },
  { value: 'for_lease', label: 'For Lease' },
  { value: 'pending', label: 'Pending' },
  { value: 'sold', label: 'Sold' },
];

export function RealEstatePage() {
  const [listings, setListings] = useState<RealEstateRecord[]>([]);
  const [stops, setStops] = useState<StopRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(blankListing);
  const [editing, setEditing] = useState<RealEstateRecord | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [data, stopData] = await Promise.all([listAdminRealEstate(), listAdminStops()]);
      setListings(data);
      setStops(stopData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load listings');
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(field: keyof RealEstateRecord, value: string) {
    if (editing) {
      setEditing({ ...editing, [field]: value });
    } else {
      setForm({ ...form, [field]: value });
    }
  }

  function handleNumberChange(field: 'price' | 'beds' | 'baths' | 'sqft' | 'latitude' | 'longitude', value: string) {
    const num = value.trim() ? Number(value) : null;
    if (editing) {
      setEditing({ ...editing, [field]: num });
    } else {
      setForm({ ...form, [field]: num });
    }
  }

  function handleActiveChange(value: boolean) {
    if (editing) {
      setEditing({ ...editing, active: value });
    } else {
      setForm({ ...form, active: value });
    }
  }

  async function handleGeocode() {
    const address = editing
      ? [editing.address, editing.city, editing.state, editing.zip].filter(Boolean).join(', ')
      : [form.address, form.city, form.state, form.zip].filter(Boolean).join(', ');
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

  function nullify<T extends Record<string, unknown>>(data: T): T {
    const out = { ...data };
    for (const key of ['description', 'property_type', 'address', 'city', 'state', 'zip', 'phone', 'email', 'website', 'image_url', 'station']) {
      if (typeof out[key] === 'string' && !(out[key] as string).trim()) (out as Record<string, unknown>)[key] = null;
    }
    return out;
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    setError(null);
    setToast(null);
    try {
      await createAdminRealEstate(nullify({ ...form }));
      setForm(blankListing);
      setToast('Listing created.');
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
      await updateAdminRealEstate(editing.id, nullify({ ...editing }));
      setEditing(null);
      setToast('Listing updated.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this listing?')) return;
    setError(null);
    try {
      await deleteAdminRealEstate(id);
      setToast('Listing deleted.');
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
          Title
          <Input value={data.title} onChange={(e) => handleInputChange('title', e.target.value)} required />
        </label>
        <div className="grid-2">
          <label>
            Price ($)
            <Input type="number" step="any" value={data.price ?? ''} onChange={(e) => handleNumberChange('price', e.target.value)} />
          </label>
          <label>
            Status
            <Select value={data.listing_status ?? 'for_sale'} onChange={(e) => handleInputChange('listing_status', e.target.value)}>
              {LISTING_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </label>
        </div>
        <div className="grid-2">
          <label>
            Property type
            <Select value={data.property_type ?? 'house'} onChange={(e) => handleInputChange('property_type', e.target.value)}>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </Select>
          </label>
          <label>
            Station
            <Select value={data.station ?? ''} onChange={(e) => handleInputChange('station', e.target.value)}>
              <option value="">— Select a stop —</option>
              {stops.map((stop) => (
                <option key={stop.id} value={stop.name}>{stop.name}</option>
              ))}
            </Select>
          </label>
        </div>
        <div className="grid-2">
          <label>
            Beds
            <Input type="number" step="any" value={data.beds ?? ''} onChange={(e) => handleNumberChange('beds', e.target.value)} />
          </label>
          <label>
            Baths
            <Input type="number" step="any" value={data.baths ?? ''} onChange={(e) => handleNumberChange('baths', e.target.value)} />
          </label>
        </div>
        <div className="grid-2">
          <label>
            Sqft
            <Input type="number" value={data.sqft ?? ''} onChange={(e) => handleNumberChange('sqft', e.target.value)} />
          </label>
          <label>
            Image URL
            <Input value={data.image_url ?? ''} onChange={(e) => handleInputChange('image_url', e.target.value)} placeholder="https://…" />
          </label>
        </div>
        <label>
          Description
          <Input value={data.description ?? ''} onChange={(e) => handleInputChange('description', e.target.value)} />
        </label>
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
            Email
            <Input value={data.email ?? ''} onChange={(e) => handleInputChange('email', e.target.value)} />
          </label>
        </div>
        <label>
          Listing URL
          <Input value={data.website ?? ''} onChange={(e) => handleInputChange('website', e.target.value)} placeholder="https://…" />
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
        <Button type="button" variant="secondary" onClick={handleGeocode} disabled={!mapboxToken}>
          Geocode address
        </Button>
        <label className="inline-row">
          <input type="checkbox" checked={data.active} onChange={(e) => handleActiveChange(e.target.checked)} />
          Visible in the app
        </label>
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
          <h1>Real Estate</h1>
          <p className="muted">Manage real-estate listings shown on the app's Real Estate tab. The tab shows "Coming soon" until a listing is added.</p>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {toast ? <SuccessBanner message={toast} /> : null}

      <div className="grid-2">
        <PageCard title="Add listing" subtitle="Create a new real-estate listing.">
          {renderForm(false)}
        </PageCard>

        <PageCard title="Listings" subtitle={`${listings.length} record${listings.length === 1 ? '' : 's'}`}>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : listings.length === 0 ? (
            <p className="muted">No listings yet — the app tab shows "Coming soon".</p>
          ) : (
            <div className="vendor-list">
              {listings.map((item) => (
                <article key={item.id} className="list-row">
                  <div>
                    <strong>{item.title}</strong>{' '}
                    <span className="muted">
                      ({LISTING_STATUSES.find((s) => s.value === item.listing_status)?.label ?? item.listing_status}
                      {item.active ? '' : ' · hidden'})
                    </span>
                    <p className="muted">
                      {[item.price != null ? `$${Number(item.price).toLocaleString()}` : null, item.station, item.city].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="row-actions">
                    <Button variant="secondary" onClick={() => setEditing(item)}>Edit</Button>
                    <Button variant="danger" onClick={() => void handleDelete(item.id)}>Delete</Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </PageCard>
      </div>

      {editing ? (
        <PageCard title="Edit listing" subtitle={editing.title}>
          {renderForm(true)}
        </PageCard>
      ) : null}
    </div>
  );
}
