import { useMemo, useState, type FormEvent, type ChangeEvent } from 'react';
import { sendMarketingBlast } from '../lib/api';
import { Button, ErrorBanner, PageCard, SuccessBanner, Textarea, Input } from '../components/Ui';
import blastTemplate from '../assets/marketing-blast-template.html?raw';

const templateSubject = "Discover today's top deals and local events for your commute.";

type TemplateValueKey =
  | 'today_date'
  | 'first_name'
  | 'deal_title'
  | 'deal_description'
  | 'deal_location'
  | 'deal_valid_until'
  | 'deal_url'
  | 'deal_2_discount'
  | 'deal_2_title'
  | 'deal_2_description'
  | 'deal_2_location'
  | 'deal_3_discount'
  | 'deal_3_title'
  | 'deal_3_description'
  | 'deal_3_location'
  | 'event_1_title'
  | 'event_1_description'
  | 'event_1_date'
  | 'event_1_location'
  | 'event_2_title'
  | 'event_2_description'
  | 'event_2_date'
  | 'event_2_location'
  | 'announcement_title'
  | 'announcement_body'
  | 'deals_hub_url';

function defaultTemplateValues(): Record<TemplateValueKey, string> {
  return {
    today_date: new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    first_name: 'there',
    deal_title: '',
    deal_description: '',
    deal_location: '',
    deal_valid_until: '',
    deal_url: '',
    deal_2_discount: '',
    deal_2_title: '',
    deal_2_description: '',
    deal_2_location: '',
    deal_3_discount: '',
    deal_3_title: '',
    deal_3_description: '',
    deal_3_location: '',
    event_1_title: '',
    event_1_description: '',
    event_1_date: '',
    event_1_location: '',
    event_2_title: '',
    event_2_description: '',
    event_2_date: '',
    event_2_location: '',
    announcement_title: '',
    announcement_body: '',
    deals_hub_url: '',
  };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fillBlastTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\{(\w+)\}\}\}/g, (_, key) => escapeHtml(values[key] ?? ''));
}

export function MarketingPage() {
  const [subject, setSubject] = useState(templateSubject);
  const [text, setText] = useState('');
  const [customHtml, setCustomHtml] = useState('');
  const [smsText, setSmsText] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ emails: number; sms: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useTemplate, setUseTemplate] = useState(true);
  const [templateValues, setTemplateValues] = useState(defaultTemplateValues);

  const generatedHtml = useMemo(
    () => (useTemplate ? fillBlastTemplate(blastTemplate, templateValues) : customHtml),
    [useTemplate, blastTemplate, templateValues, customHtml],
  );

  const updateTemplateValue = (key: TemplateValueKey) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setTemplateValues((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const effectiveText = text.trim() || (useTemplate ? templateValues.announcement_body : '');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const html = useTemplate ? generatedHtml : customHtml;
      const res = await sendMarketingBlast({
        subject,
        text: effectiveText,
        html: html || undefined,
        smsText,
      });
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
            Plain text message (used as the email text fallback; falls back to announcement body when using template)
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} />
          </label>

          <div className="flex items-center gap-2">
            <input
              id="use-template"
              type="checkbox"
              checked={useTemplate}
              onChange={(e) => {
                setUseTemplate(e.target.checked);
                if (e.target.checked) setSubject(templateSubject);
              }}
            />
            <label htmlFor="use-template" style={{ margin: 0 }}>
              Use the email template
            </label>
          </div>

          {useTemplate ? (
            <div className="form" style={{ padding: 16, background: '#f8fafc', borderRadius: 12 }}>
              <h3 style={{ margin: '0 0 8px' }}>Template fields</h3>

              <label>
                Today&apos;s date
                <Input value={templateValues.today_date} onChange={updateTemplateValue('today_date')} />
              </label>
              <label>
                Greeting first name
                <Input value={templateValues.first_name} onChange={updateTemplateValue('first_name')} placeholder="there" />
              </label>

              <h4 style={{ margin: '16px 0 8px' }}>Top deal</h4>
              <Input value={templateValues.deal_title} onChange={updateTemplateValue('deal_title')} placeholder="Deal title" />
              <Textarea value={templateValues.deal_description} onChange={updateTemplateValue('deal_description')} rows={3} placeholder="Deal description" />
              <Input value={templateValues.deal_location} onChange={updateTemplateValue('deal_location')} placeholder="Location" />
              <Input value={templateValues.deal_valid_until} onChange={updateTemplateValue('deal_valid_until')} placeholder="Valid until" />
              <Input value={templateValues.deal_url} onChange={updateTemplateValue('deal_url')} placeholder="Deal link URL" />

              <h4 style={{ margin: '16px 0 8px' }}>Deal 2</h4>
              <Input value={templateValues.deal_2_discount} onChange={updateTemplateValue('deal_2_discount')} placeholder="Discount (e.g. 20% off)" />
              <Input value={templateValues.deal_2_title} onChange={updateTemplateValue('deal_2_title')} placeholder="Title" />
              <Textarea value={templateValues.deal_2_description} onChange={updateTemplateValue('deal_2_description')} rows={3} placeholder="Description" />
              <Input value={templateValues.deal_2_location} onChange={updateTemplateValue('deal_2_location')} placeholder="Location" />

              <h4 style={{ margin: '16px 0 8px' }}>Deal 3</h4>
              <Input value={templateValues.deal_3_discount} onChange={updateTemplateValue('deal_3_discount')} placeholder="Discount (e.g. Free appetizer)" />
              <Input value={templateValues.deal_3_title} onChange={updateTemplateValue('deal_3_title')} placeholder="Title" />
              <Textarea value={templateValues.deal_3_description} onChange={updateTemplateValue('deal_3_description')} rows={3} placeholder="Description" />
              <Input value={templateValues.deal_3_location} onChange={updateTemplateValue('deal_3_location')} placeholder="Location" />

              <h4 style={{ margin: '16px 0 8px' }}>Events</h4>
              <Input value={templateValues.event_1_title} onChange={updateTemplateValue('event_1_title')} placeholder="Event 1 title" />
              <Textarea value={templateValues.event_1_description} onChange={updateTemplateValue('event_1_description')} rows={2} placeholder="Event 1 description" />
              <Input value={templateValues.event_1_date} onChange={updateTemplateValue('event_1_date')} placeholder="Event 1 date" />
              <Input value={templateValues.event_1_location} onChange={updateTemplateValue('event_1_location')} placeholder="Event 1 location" />

              <Input value={templateValues.event_2_title} onChange={updateTemplateValue('event_2_title')} placeholder="Event 2 title" />
              <Textarea value={templateValues.event_2_description} onChange={updateTemplateValue('event_2_description')} rows={2} placeholder="Event 2 description" />
              <Input value={templateValues.event_2_date} onChange={updateTemplateValue('event_2_date')} placeholder="Event 2 date" />
              <Input value={templateValues.event_2_location} onChange={updateTemplateValue('event_2_location')} placeholder="Event 2 location" />

              <h4 style={{ margin: '16px 0 8px' }}>Announcement</h4>
              <Input value={templateValues.announcement_title} onChange={updateTemplateValue('announcement_title')} placeholder="Title" />
              <Textarea value={templateValues.announcement_body} onChange={updateTemplateValue('announcement_body')} rows={3} placeholder="Body" />

              <label>
                Deals hub URL
                <Input value={templateValues.deals_hub_url} onChange={updateTemplateValue('deals_hub_url')} placeholder="https://lightraildeals.com/deals" />
              </label>
            </div>
          ) : (
            <label>
              HTML message (optional)
              <Textarea value={customHtml} onChange={(e) => setCustomHtml(e.target.value)} rows={12} />
            </label>
          )}

          <label>
            SMS message (optional; sent to members who opted in to text messages)
            <Textarea value={smsText} onChange={(e) => setSmsText(e.target.value)} rows={3} />
          </label>
          <Button type="submit" disabled={sending || !subject.trim() || !effectiveText.trim()}>
            {sending ? 'Sending…' : 'Send blast'}
          </Button>
        </form>
      </PageCard>
    </div>
  );
}
