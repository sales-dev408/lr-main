import { useEffect, useState } from 'react';
import { fetchPublicEvents, getEventsRssUrls, saveEventsRssUrls } from '../lib/api';
import { Badge, Button, ErrorBanner, PageCard, SuccessBanner, Textarea } from '../components/Ui';

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function EventsPage() {
  const [urls, setUrls] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ count: number; items: { title: string; sourceName: string }[] } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { urls: existing } = await getEventsRssUrls();
        setUrls(existing.join('\n'));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load event feeds');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function parseUrls(): string[] {
    return urls
      .split('\n')
      .map((url) => normalizeUrl(url))
      .filter(Boolean);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setToast(null);
    setPreview(null);
    try {
      const list = parseUrls();
      await saveEventsRssUrls(list);
      setUrls(list.join('\n'));
      setToast('Event RSS feeds saved.');
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

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Events</h1>
          <p className="muted">Configure the RSS feed URLs that power the Events tab in the mobile app.</p>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {toast ? <SuccessBanner message={toast} /> : null}

      <PageCard title="RSS feeds" subtitle="One URL per line. Plain URLs are automatically prefixed with https://">
        {loading ? (
          <div className="muted">Loading…</div>
        ) : (
          <>
            <Textarea
              rows={8}
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="https://example.com/events.rss\nexample.com/feed.xml"
            />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save feeds'}
              </Button>
              <Button variant="secondary" onClick={handlePreview} disabled={previewing}>
                {previewing ? 'Previewing…' : 'Preview events'}
              </Button>
            </div>

            {preview ? (
              <div style={{ marginTop: 16 }}>
                <p className="muted">
                  Found <strong>{preview.count}</strong> event{preview.count === 1 ? '' : 's'}.
                </p>
                {preview.items.length > 0 ? (
                  <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                    {preview.items.map((item, index) => (
                      <li key={index}>
                        {item.title} <Badge tone="neutral">{item.sourceName}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </PageCard>
    </div>
  );
}
