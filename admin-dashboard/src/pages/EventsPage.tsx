import { useEffect, useState, type FormEvent } from 'react';
import { createAdminEvent, deleteAdminEvent, fetchPublicEvents, getEventsRssUrls, saveEventsRssUrls, updateAdminEvent } from '../lib/api';
import type { AdminEvent } from '../lib/types';
import { Badge, Button, ErrorBanner, Input, PageCard, SuccessBanner, Textarea } from '../components/Ui';

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function EventsPage() {
  const [urls, setUrls] = useState<string>('');
  const [customEvents, setCustomEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ count: number; items: { title: string; sourceName: string }[] } | null>(null);

  const [newEvent, setNewEvent] = useState({ title: '', description: '', eventDate: '' });
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { urls: existing, events } = await getEventsRssUrls();
      setUrls(existing.join('\n'));
      setCustomEvents(events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load event feeds');
    } finally {
      setLoading(false);
    }
  }

  function parseUrls(): string[] {
    return urls
      .split('\n')
      .map((url) => normalizeUrl(url))
      .filter(Boolean);
  }

  async function handleSaveFeeds() {
    setSaving(true);
    setError(null);
    setToast(null);
    setPreview(null);
    try {
      const list = parseUrls();
      await saveEventsRssUrls(list);
      setUrls(list.join('\n'));
      setToast('RSS feeds saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save event feeds');
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    setPreviewing(true);
    setError(null);
    setToast(null);
    setPreview(null);
    try {
      const events = await fetchPublicEvents();
      setPreview({
        count: events.length,
        items: events.slice(0, 5).map((e) => ({ title: e.title, sourceName: e.sourceName ?? 'Unknown source' })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to preview events');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleCreateEvent(event: FormEvent) {
    event.preventDefault();
    if (!newEvent.title.trim()) return;
    setError(null);
    try {
      const created = await createAdminEvent({
        title: newEvent.title.trim(),
        description: newEvent.description.trim() || undefined,
        eventDate: newEvent.eventDate || undefined,
      });
      setCustomEvents((prev) => [created, ...prev]);
      setNewEvent({ title: '', description: '', eventDate: '' });
      setToast('Event saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save event');
    }
  }

  async function handleUpdateEvent(event: FormEvent) {
    event.preventDefault();
    if (!editingEvent) return;
    setError(null);
    try {
      const updated = await updateAdminEvent(editingEvent.id, {
        title: editingEvent.title.trim(),
        description: editingEvent.description || null,
        eventDate: editingEvent.eventDate || null,
      });
      setCustomEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEditingEvent(null);
      setToast('Event updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update event');
    }
  }

  async function handleDeleteEvent(id: string) {
    if (!confirm('Delete this event?')) return;
    setError(null);
    try {
      await deleteAdminEvent(id);
      setCustomEvents((prev) => prev.filter((e) => e.id !== id));
      setToast('Event deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete event');
    }
  }

  function formatDate(date: string | null): string {
    if (!date) return 'No date';
    return new Date(date).toLocaleDateString();
  }

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Events</h1>
          <p className="muted">Paste an RSS feed to import events, or add your own events manually.</p>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {toast ? <SuccessBanner message={toast} /> : null}

      <div className="grid-2">
        <PageCard title="RSS feeds" subtitle="One URL per line. Plain URLs are automatically prefixed with https://">
          {loading ? (
            <div className="muted">Loading…</div>
          ) : (
            <>
              <Textarea rows={8} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://example.com/events.rss" />
              <div className="inline-row" style={{ marginTop: 12 }}>
                <Button onClick={handleSaveFeeds} disabled={saving}>{saving ? 'Saving…' : 'Save feeds'}</Button>
                <Button variant="secondary" onClick={handlePreview} disabled={previewing}>{previewing ? 'Previewing…' : 'Preview events'}</Button>
              </div>
            </>
          )}
        </PageCard>

        <PageCard title="Add your own event" subtitle="Type the event name, description, and date.">
          <form className="form" onSubmit={handleCreateEvent}>
            <label>
              Event name
              <Input value={newEvent.title} onChange={(e) => setNewEvent((prev) => ({ ...prev, title: e.target.value }))} required />
            </label>
            <label>
              Description
              <Textarea value={newEvent.description} onChange={(e) => setNewEvent((prev) => ({ ...prev, description: e.target.value }))} />
            </label>
            <label>
              Date
              <Input type="date" value={newEvent.eventDate} onChange={(e) => setNewEvent((prev) => ({ ...prev, eventDate: e.target.value }))} />
            </label>
            <Button type="submit">Save event</Button>
          </form>
        </PageCard>
      </div>

      {preview ? (
        <PageCard title="Preview" subtitle={`Found ${preview.count} event${preview.count === 1 ? '' : 's'}`}>
          {preview.items.length > 0 ? (
            <ul className="event-preview-list">
              {preview.items.map((item, index) => (
                <li key={index}>{item.title} <Badge tone="neutral">{item.sourceName}</Badge></li>
              ))}
            </ul>
          ) : <p className="muted">No events to preview.</p>}
        </PageCard>
      ) : null}

      <PageCard title="Your events" subtitle="Events you add manually appear in the app alongside RSS events.">
        {customEvents.length === 0 ? <p className="muted">No custom events yet.</p> : null}
        <div className="vendor-list">
          {customEvents.map((event) => (
            <article key={event.id} className="list-row">
              <div>
                <strong>{event.title}</strong>
                <p className="muted">{formatDate(event.eventDate)}</p>
                {event.description ? <p className="muted">{event.description}</p> : null}
              </div>
              <div className="row-actions">
                <Button variant="secondary" onClick={() => setEditingEvent(event)}>Edit</Button>
                <Button variant="danger" onClick={() => void handleDeleteEvent(event.id)}>Delete</Button>
              </div>
            </article>
          ))}
        </div>
      </PageCard>

      {editingEvent ? (
        <PageCard title="Edit event" subtitle={editingEvent.title}>
          <form className="form" onSubmit={handleUpdateEvent}>
            <label>
              Event name
              <Input value={editingEvent.title} onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })} required />
            </label>
            <label>
              Description
              <Textarea value={editingEvent.description ?? ''} onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })} />
            </label>
            <label>
              Date
              <Input type="date" value={editingEvent.eventDate ?? ''} onChange={(e) => setEditingEvent({ ...editingEvent, eventDate: e.target.value })} />
            </label>
            <div className="inline-row">
              <Button type="submit">Update event</Button>
              <Button variant="ghost" onClick={() => setEditingEvent(null)}>Cancel</Button>
            </div>
          </form>
        </PageCard>
      ) : null}
    </div>
  );
}
