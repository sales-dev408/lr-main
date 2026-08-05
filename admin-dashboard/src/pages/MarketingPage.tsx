import { useState, type FormEvent } from 'react';
import { sendMarketingBlast } from '../lib/api';
import { Button, ErrorBanner, PageCard, SuccessBanner, Textarea, Input } from '../components/Ui';

export function MarketingPage() {
  const [subject, setSubject] = useState('Deal of the Day from Light Rail Deals');
  const [text, setText] = useState('');
  const [html, setHtml] = useState('');
  const [smsText, setSmsText] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ emails: number; sms: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await sendMarketingBlast({ subject, text, html, smsText });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Marketing</h1>
          <p className="muted">Send a Deal of the Day email and SMS blast to opted-in members.</p>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {result ? (
        <SuccessBanner
          message={`Blast sent: ${result.emails} emails, ${result.sms} SMS. ${result.errors.length > 0 ? `${result.errors.length} errors.` : ''}`}
        />
      ) : null}

      <PageCard title="Deal of the Day blast">
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Subject
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </label>
          <label>
            Plain text message
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} required />
          </label>
          <label>
            HTML message (optional)
            <Textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={8} />
          </label>
          <label>
            SMS message (optional; sent to members who opted in to text messages)
            <Textarea value={smsText} onChange={(e) => setSmsText(e.target.value)} rows={3} />
          </label>
          <Button type="submit" disabled={sending || !text.trim() || !subject.trim()}>
            {sending ? 'Sending…' : 'Send blast'}
          </Button>
        </form>
      </PageCard>
    </div>
  );
}
