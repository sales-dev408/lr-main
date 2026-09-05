import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { createAdminEvent, deleteAdminEvent, fetchPublicEvents, fileToDataUrl, getEventsRssUrls, saveEventsRssUrls, updateAdminEvent, ApiError } from '../lib/api';
import type { AdminEvent } from '../lib/types';
import { Badge, Button, ErrorBanner, Input, PageCard, SuccessBanner, Textarea } from '../components/Ui';

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// ---- JSON import helpers ---------------------------------------------------

// Canonical field -> accepted aliases (compared case- and punctuation-insensitively).
const FIELD_ALIASES: Record<keyof ParsedEventRow, string[]> = {
  title: ['name', 'title', 'event', 'eventname', 'eventtitle', 'subject', 'summarytitle'],
  description: ['description', 'desc', 'details', 'summary', 'about', 'info', 'body', 'content', 'text'],
  eventDate: ['date', 'time', 'datetime', 'eventdate', 'when', 'startdate', 'start', 'begins', 'beginsat', 'eventtime', 'dateonly', 'timeonly', 'occurs', 'occursat'],
  location: ['location', 'venue', 'place', 'where', 'address', 'city', 'locationname', 'placename', 'town'],
  link: ['link', 'url', 'website', 'href', 'registration', 'register', 'tickets', 'ticketurl', 'eventurl', 'moreinfo', 'source', 'sourceurl', 'more'],
};

interface ParsedEventRow {
  title?: string;
  description?: string;
  eventDate?: string;
  location?: string;
  link?: string;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Build a reverse lookup: normalized alias -> canonical field name.
const ALIAS_LOOKUP: Record<string, keyof ParsedEventRow> = (() => {
  const map: Record<string, keyof ParsedEventRow> = {};
  (Object.keys(FIELD_ALIASES) as (keyof ParsedEventRow)[]).forEach((field) => {
    map[normalizeKey(field)] = field;
    FIELD_ALIASES[field].forEach((alias) => {
      map[normalizeKey(alias)] = field;
    });
  });
  return map;
})();

function coerceString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim() || undefined;
  return undefined;
}

function toDateOnly(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // Already YYYY-MM-DD?
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return undefined;
}

function parseEventRows(raw: string): ParsedEventRow[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error('Invalid JSON: ' + (err instanceof Error ? err.message : 'parse error'));
  }

  // Accept a top-level array, a single object, or an object wrapping an array under common keys.
  let records: unknown[] = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const wrapperKey = Object.keys(obj).find((k) => {
      const n = normalizeKey(k);
      return (n === 'events' || n === 'data' || n === 'items' || n === 'list' || n === 'rows') && Array.isArray(obj[k]);
    });
    if (wrapperKey) {
      records = obj[wrapperKey] as unknown[];
    } else {
      records = [data];
    }
  } else {
    throw new Error('JSON must be an object or an array of objects.');
  }

  return records.map((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error(`Row ${index + 1} is not an object.`);
    }
    const row: ParsedEventRow = {};
    for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
      const field = ALIAS_LOOKUP[normalizeKey(key)];
      if (!field) continue;
      const text = coerceString(value);
      if (text === undefined) continue;
      // Don't overwrite an already-matched canonical field.
      if (row[field] === undefined) row[field] = text;
    }
    return row;
  });
}

function rowToEventInput(row: ParsedEventRow): { title: string; description?: string; eventDate?: string } | null {
  const title = row.title?.trim();
  if (!title) return null;
  const extras: string[] = [];
  if (row.location) extras.push(`Location: ${row.location}`);
  if (row.link) extras.push(`Link: ${row.link}`);
  const description = [row.description?.trim(), ...extras].filter(Boolean).join('\n\n') || undefined;
  const eventDate = row.eventDate ? toDateOnly(row.eventDate) : undefined;
  return { title, description, eventDate };
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

  const [newEvent, setNewEvent] = useState({ title: '', description: '', eventDate: '', imageUrl: '' });
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);

  // JSON bulk import state
  const [jsonText, setJsonText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; failed: number; errors: string[] } | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { urls: existing, events } = await getEventsRssUrls();
      setUrls(existing.join('\n'));
      setCustomEvents(events ?? []);
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
      const events = (await fetchPublicEvents()) ?? [];
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
        imageUrl: newEvent.imageUrl.trim() || null,
      });
      setCustomEvents((prev) => [created, ...prev]);
      setNewEvent({ title: '', description: '', eventDate: '', imageUrl: '' });
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
        imageUrl: editingEvent.imageUrl || null,
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
    } catch (err) {
      // If the event was already gone (404), treat it as success and
      // remove it from the local list so the UI stays consistent.
      if (!(err instanceof ApiError && err.status === 404)) {
        setError(err instanceof Error ? err.message : 'Unable to delete event');
        return;
      }
    }
    setCustomEvents((prev) => prev.filter((e) => e.id !== id));
    setToast('Event deleted.');
  }

  async function handleImportJson() {
    setError(null);
    setToast(null);
    setImportResult(null);
    if (!jsonText.trim()) {
      setError('Paste a JSON array of events first.');
      return;
    }
    let rows: ParsedEventRow[];
    try {
      rows = parseEventRows(jsonText);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to parse JSON');
      return;
    }
    if (rows.length === 0) {
      setError('No event rows found in the JSON.');
      return;
    }

    setImporting(true);
    let created = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];
    const createdEvents: AdminEvent[] = [];

    for (let i = 0; i < rows.length; i++) {
      const input = rowToEventInput(rows[i]!);
      if (!input) {
        skipped++;
        errors.push(`Row ${i + 1}: skipped (no name/title).`);
        continue;
      }
      try {
        const event = await createAdminEvent(input);
        createdEvents.push(event);
        created++;
      } catch (err) {
        failed++;
        errors.push(`Row ${i + 1} ("${input.title}"): ${err instanceof Error ? err.message : 'failed'}`);
      }
    }

    if (createdEvents.length > 0) {
      setCustomEvents((prev) => [...createdEvents.reverse(), ...prev]);
    }
    setImportResult({ created, skipped, failed, errors: errors.slice(0, 20) });
    if (failed === 0 && created > 0) {
      setToast(`Imported ${created} event${created === 1 ? '' : 's'}.`);
      setJsonText('');
    } else if (created > 0) {
      setToast(`Imported ${created}, ${failed} failed, ${skipped} skipped.`);
    } else {
      setError(`No events imported. ${failed} failed, ${skipped} skipped.`);
    }
    setImporting(false);
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
          <p className="muted">Add events or import from a feed to show in the app.</p>
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
            <label>
              Event image
              <Input type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (file) {
                  void fileToDataUrl(file).then((url) => setNewEvent((prev) => ({ ...prev, imageUrl: url })));
                }
              }} />
            </label>
            {newEvent.imageUrl ? <img src={newEvent.imageUrl} alt="" style={{ maxWidth: 200, borderRadius: 8 }} /> : null}
            <Button type="submit">Save event</Button>
          </form>
        </PageCard>
      </div>

      <PageCard
        title="Import from JSON"
        subtitle="Paste a JSON array of events. Column names are case-insensitive (e.g. name, title, date/time, location, description, link). Only a name/title is required; other columns are optional. Location and link are appended to the description."
      >
        <Textarea
          rows={12}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder={'[\n  {\n    "name": "Summer Festival",\n    "date/time": "2026-07-04T18:00",\n    "location": "Central Park",\n    "description": "Food trucks and live music.",\n    "link": "https://example.com/tickets"\n  }\n]'}
        />
        <div className="inline-row" style={{ marginTop: 12 }}>
          <Button onClick={handleImportJson} disabled={importing || !jsonText.trim()}>
            {importing ? 'Importing…' : 'Import events'}
          </Button>
          {jsonText.trim() ? (
            <Button variant="ghost" onClick={() => { setJsonText(''); setImportResult(null); }} disabled={importing}>
              Clear
            </Button>
          ) : null}
        </div>
        {importResult ? (
          <div className="muted" style={{ marginTop: 12 }}>
            <p>
              Created: <strong>{importResult.created}</strong> · Skipped: <strong>{importResult.skipped}</strong> · Failed: <strong>{importResult.failed}</strong>
            </p>
            {importResult.errors.length > 0 ? (
              <ul className="event-preview-list" style={{ marginTop: 8 }}>
                {importResult.errors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </PageCard>

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
            <label>
              Event image
              <Input type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (file) {
                  void fileToDataUrl(file).then((url) => setEditingEvent((prev) => (prev ? { ...prev, imageUrl: url } : prev)));
                }
              }} />
            </label>
            {editingEvent.imageUrl ? <img src={editingEvent.imageUrl} alt="" style={{ maxWidth: 200, borderRadius: 8 }} /> : null}
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
