import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { fileToDataUrl, listAdminCards, updateCard } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { CardSummary } from '../lib/types';
import { Button, EmptyState, ErrorBanner, Input, PageCard, Select, Textarea } from '../components/Ui';

function parseImageUrls(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item) => typeof item === 'string' && item.length > 0);
    if (typeof parsed === 'string') return [parsed];
    return [];
  } catch {
    return value ? [value] : [];
  }
}

function serializeImageUrls(urls: string[]): string | null {
  const clean = urls.filter((url) => url.trim().length > 0);
  if (clean.length === 0) return null;
  return clean.length > 1 ? JSON.stringify(clean) : clean[0]!;
}

export function CardsPage() {
  const { profile } = useAuth();
  const readOnly = profile?.role === 'analyst';
  const [card, setCard] = useState<CardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    imageUrls: [] as string[],
    status: 'draft' as 'draft' | 'active' | 'archived',
  });

  const previewImage = useMemo(() => form.imageUrls[0] ?? null, [form.imageUrls]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const cards = await listAdminCards();
        const membership = cards.find((c) => c.is_membership) ?? cards[0] ?? null;
        if (membership && active) {
          setCard(membership);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load card');
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!card) return;
    setForm({
      name: card.name,
      description: card.description ?? '',
      imageUrls: parseImageUrls(card.image_url),
      status: card.status,
    });
  }, [card]);

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, dataUrl] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read image');
    } finally {
      if (event.target) event.target.value = '';
    }
  }

  function removeImage(index: number) {
    setForm((prev) => ({ ...prev, imageUrls: prev.imageUrls.filter((_, i) => i !== index) }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || !card) return;
    setSaving(true);
    setError(null);
    try {
      await updateCard(card.id, {
        name: form.name,
        description: form.description || null,
        imageUrl: serializeImageUrls(form.imageUrls),
        status: form.status,
      });
      const cards = await listAdminCards();
      const membership = cards.find((c) => c.is_membership) ?? cards[0] ?? null;
      setCard(membership);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Cards</h1>
          <p className="muted">Manage the Master Discount Card and its participating businesses.</p>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <div className="grid-2">
        <PageCard title="Edit card" subtitle={readOnly ? 'Read-only analyst mode' : card?.name ?? 'Master Discount Card'}>
          {card ? (
            <form className="form" onSubmit={submit}>
              <label>
                Card name
                <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
              </label>
              <label>
                Description
                <Textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
              </label>
              <label>
                Background images
                <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={readOnly} />
              </label>
              {form.imageUrls.length > 0 ? (
                <div className="image-preview-grid">
                  {form.imageUrls.map((url, index) => (
                    <div key={`${url}-${index}`} className="image-preview">
                      <img src={url} alt={`Background ${index + 1}`} />
                      {!readOnly ? (
                        <Button type="button" variant="secondary" onClick={() => removeImage(index)}>Remove</Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              <label>
                Status
                <Select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as typeof form.status }))}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </Select>
              </label>
              <Button type="submit" disabled={readOnly || saving}>{saving ? 'Saving…' : 'Save card'}</Button>
            </form>
          ) : (
            <EmptyState title="Loading card…" description="The master discount card is being loaded." />
          )}
        </PageCard>

        <PageCard title="Participating businesses" subtitle={card?.name ?? 'Master Discount Card'}>
          {card ? (
            card.participatingBusinesses?.length ? (
              <div className="vendor-list">
                {card.participatingBusinesses.map((business) => (
                  <article key={business.id} className="list-row">
                    <div>
                      <strong>{business.name}</strong>
                      <p className="muted">{business.city ?? '—'}</p>
                      {business.discount ? <span className="muted">{business.discount.type === 'bogo' ? 'BOGO' : `${business.discount.value} ${business.discount.type}`}</span> : <span className="muted">No discount</span>}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="No businesses" description="Vendors created from the Vendors tab will appear here once linked to the card." />
            )
          ) : (
            <EmptyState title="Loading…" description="" />
          )}
        </PageCard>
      </div>

      {previewImage ? (
        <PageCard title="Card preview" subtitle="Scales to fit any phone screen">
          <div className="card-preview">
            <div className="card-preview-body">
              {form.imageUrls.length > 0 ? (
                <img src={previewImage} alt="Card background" className="card-preview-bg" />
              ) : null}
              <div className="card-preview-content">
                <h2>{form.name || 'Card name'}</h2>
                <p>{form.description || 'Card description'}</p>
              </div>
            </div>
          </div>
        </PageCard>
      ) : null}
    </div>
  );
}
