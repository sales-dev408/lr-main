import { useEffect, useState } from 'react';
import { getEventsRssUrls, saveEventsRssUrls } from '../lib/api';
import { Button, ErrorBanner, PageCard, SuccessBanner, Textarea } from '../components/Ui';

export function EventsPage() {
  const [urls, setUrls] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  async function handleSave() {
    setSaving(true);
    setError(null);
    setToast(null);
    try {
      const list = urls.split('\n').map((url) => url.trim()).filter(Boolean);
      await saveEventsRssUrls(list);
      setToast('Event RSS feeds saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save event feeds');
    } finally {
      setSaving(false);
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

      <PageCard title="RSS feeds" subtitle="One URL per line. The app combines and sorts events from all feeds.">
        {loading ? (
          <div className="muted">Loading…</div>
        ) : (
          <>
            <Textarea
              rows={8}
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="https://example.com/events.rss\nhttps://example.com/feed.xml"
            />
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save feeds'}
            </Button>
          </>
        )}
      </PageCard>
    </div>
  );
}
