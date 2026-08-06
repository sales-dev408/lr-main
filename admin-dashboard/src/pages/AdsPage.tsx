import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Button, EmptyState, ErrorBanner, Input, PageCard, Select, SuccessBanner, Spinner } from '../components/Ui';
import { createAd, deleteAd, fileToDataUrl, listAds, updateAd } from '../lib/api';
import type { AdRecord } from '../lib/types';

const SLOT_OPTIONS = [1, 2, 3, 4, 5];

const EMPTY_FORM = {
  slot: 1,
  image_url: '',
  link_url: '',
  active: true,
};

export function AdsPage() {
  const [ads, setAds] = useState<AdRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setAds(await listAds());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load ads');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function startEdit(ad: AdRecord) {
    setEditingId(ad.id);
    setForm({
      slot: ad.slot,
      image_url: ad.image_url,
      link_url: ad.link_url ?? '',
      active: ad.active,
    });
  }

  function reset() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((prev) => ({ ...prev, image_url: dataUrl }));
      setError(null);
    } catch {
      setError('Unable to read image file');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setToast(null);
    try {
      const payload = {
        slot: Number(form.slot),
        image_url: form.image_url,
        link_url: form.link_url || null,
        active: form.active,
      };
      if (editingId) {
        await updateAd(editingId, payload);
      } else {
        await createAd(payload);
      }
      setToast('Ad saved');
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save ad');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this ad?')) return;
    setError(null);
    try {
      await deleteAd(id);
      setToast('Ad deleted');
      if (editingId === id) reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete ad');
    }
  }

  return (
    <div className="stack">
      {toast ? <SuccessBanner message={toast} /> : null}
      <PageCard title="Ad placements" subtitle="Manage up to 5 sponsor ads shown in the app.">
        {error ? <ErrorBanner message={error} /> : null}
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 12 }}>
          <label>
            Ad slot
            <Select value={form.slot} onChange={(e) => setForm({ ...form, slot: Number(e.target.value) })}>
              {SLOT_OPTIONS.map((slot) => (
                <option key={slot} value={slot}>Slot {slot}</option>
              ))}
            </Select>
          </label>
          <label>
            Image
            <Input type="file" accept="image/*" onChange={handleFile} />
          </label>
          {form.image_url ? (
            <img src={form.image_url} alt="Ad preview" style={{ maxWidth: '100%', maxHeight: 160, objectFit: 'contain' }} />
          ) : null}
          <label>
            Link URL (optional)
            <Input type="url" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://example.com" />
          </label>
          <label className="inline-row" style={{ alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Active
          </label>
          <div className="inline-row">
            <Button type="submit" disabled={saving || !form.image_url}>{editingId ? 'Update ad' : 'Save ad'}</Button>
            {editingId ? <Button variant="secondary" onClick={reset}>Cancel</Button> : null}
          </div>
        </form>
      </PageCard>

      <PageCard title="Current ads">
        {loading ? <Spinner /> : null}
        {!loading && ads.length === 0 ? <EmptyState title="No ads" description="Use the form above to add up to 5 ads." /> : null}
        {!loading && ads.length > 0 ? (
          <div className="stack" style={{ gap: 12 }}>
            {ads.map((ad) => (
              <div key={ad.id} className="list-row" style={{ alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <strong>Slot {ad.slot}</strong>
                  {ad.active ? null : <span className="muted" style={{ marginLeft: 8 }}>(inactive)</span>}
                  {ad.link_url ? <p className="muted">{ad.link_url}</p> : null}
                </div>
                {ad.image_url ? (
                  <img src={ad.image_url} alt="" style={{ width: 80, height: 60, objectFit: 'contain', marginRight: 12 }} />
                ) : null}
                <div className="inline-row">
                  <Button variant="secondary" onClick={() => startEdit(ad)}>Edit</Button>
                  <Button variant="danger" onClick={() => handleDelete(ad.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </PageCard>
    </div>
  );
}
