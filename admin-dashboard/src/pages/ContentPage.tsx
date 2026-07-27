import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { createContent, deleteContent, fileToDataUrl, listContent, updateContent } from '../lib/api';
import { Badge, Button, EmptyState, ErrorBanner, Input, PageCard, Select, SuccessBanner, Textarea } from '../components/Ui';
import type { ContentBlock, ContentKind } from '../lib/types';

const KIND_OPTIONS: Array<{ value: ContentKind; label: string }> = [
  { value: 'text', label: 'Text block' },
  { value: 'article', label: 'Article' },
  { value: 'image', label: 'Image' },
  { value: 'file', label: 'File / download' },
  { value: 'embed', label: 'Embed (URL)' },
];

const EMPTY_FORM = { kind: 'text' as ContentKind, title: '', body: '', url: '', position: 0, published: true };

export function ContentPage() {
  const [items, setItems] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await listContent());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load content');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setDataUrl(null);
  }

  function startEdit(item: ContentBlock) {
    setEditingId(item.id);
    setForm({
      kind: item.kind,
      title: item.title,
      body: item.body ?? '',
      url: item.url ?? '',
      position: item.position,
      published: item.published,
    });
    setDataUrl(null);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setDataUrl(await fileToDataUrl(file));
    } catch {
      setError('Unable to read file');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setToast(null);
    try {
      const payload = {
        kind: form.kind,
        title: form.title,
        body: form.body || undefined,
        url: form.url || undefined,
        dataUrl: dataUrl || undefined,
        position: Number(form.position) || 0,
        published: form.published,
      };
      if (editingId) {
        await updateContent(editingId, payload);
        setToast('Content updated.');
      } else {
        await createContent(payload);
        setToast('Content published.');
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save content');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this content block?')) return;
    try {
      await deleteContent(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete content');
    }
  }

  const needsMedia = form.kind === 'image' || form.kind === 'file';
  const needsUrl = form.kind === 'embed';

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Content</h1>
          <p className="muted">Publish text, articles, images, files, and embeds to the app's Discover feed.</p>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {toast ? <SuccessBanner message={toast} /> : null}

      <PageCard title={editingId ? 'Edit content' : 'Add content'}>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Type
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ContentKind })}>
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label>
            Title
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </label>
          {form.kind === 'text' || form.kind === 'article' ? (
            <label>
              Body
              <Textarea rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </label>
          ) : null}
          {needsUrl ? (
            <label>
              Embed URL
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
            </label>
          ) : null}
          {needsMedia ? (
            <label>
              {form.kind === 'image' ? 'Image file' : 'File'}
              <input type="file" accept={form.kind === 'image' ? 'image/*' : undefined} onChange={handleFile} />
              {dataUrl ? <span className="muted">New file ready to upload</span> : form.url ? <span className="muted">Current: {form.url}</span> : null}
            </label>
          ) : null}
          <label>
            Order
            <Input type="number" value={form.position} onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
            Published
          </label>
          <div className="row-actions">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update' : 'Publish'}
            </Button>
            {editingId ? (
              <Button variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </PageCard>

      <PageCard title="Published & drafts">
        {loading ? (
          <div className="muted">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState title="No content yet" description="Add your first content block above." />
        ) : (
          <ul className="content-list">
            {items.map((item) => (
              <li key={item.id} className="content-row">
                <div className="content-meta">
                  <div className="content-title-row">
                    <strong>{item.title || '(untitled)'}</strong>
                    <Badge tone="neutral">{item.kind}</Badge>
                    {item.published ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>}
                  </div>
                  {item.body ? <p className="muted content-excerpt">{item.body}</p> : null}
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer" className="muted">
                      {item.url}
                    </a>
                  ) : null}
                </div>
                <div className="row-actions">
                  <Button variant="secondary" onClick={() => startEdit(item)}>
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => handleDelete(item.id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PageCard>
    </div>
  );
}
