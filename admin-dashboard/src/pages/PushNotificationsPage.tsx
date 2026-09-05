import { useState, type FormEvent } from 'react';
import { sendPushNotification } from '../lib/api';
import { Button, ErrorBanner, Input, PageCard, SuccessBanner, Textarea } from '../components/Ui';

export function PushNotificationsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [city, setCity] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await sendPushNotification({
        title: title.trim(),
        message: message.trim(),
        city: city.trim() || undefined,
      });
      if (res.sent === 0) {
        setResult(res.message ?? 'No push tokens registered for the selected audience.');
      } else {
        const errorNote = res.errors && res.errors.length > 0 ? ` (${res.errors.length} error${res.errors.length === 1 ? '' : 's'})` : '';
        setResult(`Push notification sent to ${res.sent} device${res.sent === 1 ? '' : 's'}${errorNote}.`);
      }
      setTitle('');
      setMessage('');
      setCity('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send push notification');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Push Notifications</h1>
          <p className="muted">Send an instant push notification to members with the app installed.</p>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {result ? <SuccessBanner message={result} /> : null}

      <PageCard title="Send a push notification" subtitle="Messages are delivered instantly to all members with push enabled.">
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Notification title
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New deal available!"
              maxLength={100}
              required
            />
          </label>
          <label>
            Message
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the notification message…"
              rows={4}
              maxLength={500}
              required
            />
          </label>
          <label>
            City (optional)
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Leave blank to send to all members"
            />
          </label>
          <small className="muted">If a city is specified, only members who set that city in their profile will receive the notification.</small>
          <Button type="submit" disabled={sending || !title.trim() || !message.trim()}>
            {sending ? 'Sending…' : 'Send push notification'}
          </Button>
        </form>
      </PageCard>
    </div>
  );
}
