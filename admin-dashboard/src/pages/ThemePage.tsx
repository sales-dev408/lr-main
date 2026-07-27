import { useEffect, useState } from 'react';
import { getTheme, saveTheme } from '../lib/api';
import { Button, ErrorBanner, Input, PageCard, SuccessBanner } from '../components/Ui';
import { DEFAULT_THEME, useTheme } from '../lib/theme';
import type { ThemeSettings } from '../lib/types';

export function ThemePage() {
  const shell = useTheme();
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setTheme(await getTheme());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load theme');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function updateTab(index: number, patch: Partial<ThemeSettings['tabs'][number]>) {
    setTheme((prev) => ({
      ...prev,
      tabs: prev.tabs.map((tab, i) => (i === index ? { ...tab, ...patch } : tab)),
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setToast(null);
    try {
      const saved = await saveTheme(theme);
      setTheme(saved);
      // Apply immediately to the admin shell; the app picks it up on next load.
      shell.setTheme(saved);
      setToast('Theme saved. It applies to the app and admin site.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save theme');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="muted">Loading…</div>;
  }

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Theme</h1>
          <p className="muted">Configure the blue / red / green gradient bottom tabs shared by the app and admin site.</p>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {toast ? <SuccessBanner message={toast} /> : null}

      <PageCard title="Brand">
        <div className="form">
          <label>
            Primary brand color
            <div className="color-field">
              <input type="color" value={theme.brand} onChange={(e) => setTheme({ ...theme, brand: e.target.value })} />
              <Input value={theme.brand} onChange={(e) => setTheme({ ...theme, brand: e.target.value })} />
            </div>
          </label>
          <label>
            Header gradient
            <div className="color-field">
              <input type="color" value={theme.primaryGradient[0]} onChange={(e) => setTheme({ ...theme, primaryGradient: [e.target.value, theme.primaryGradient[1]] })} />
              <input type="color" value={theme.primaryGradient[1]} onChange={(e) => setTheme({ ...theme, primaryGradient: [theme.primaryGradient[0], e.target.value] })} />
            </div>
          </label>
        </div>
      </PageCard>

      <PageCard title="Bottom tabs" subtitle="Each tab has a color and a two-stop gradient used for its icon.">
        <div className="tab-preview">
          {theme.tabs.map((tab) => (
            <div key={tab.key} className="tab-preview-item">
              <span className="tab-preview-icon" style={{ backgroundImage: `linear-gradient(135deg, ${tab.gradient[0]}, ${tab.gradient[1]})` }} />
              <span className="tab-preview-label" style={{ color: tab.color }}>
                {tab.label}
              </span>
            </div>
          ))}
        </div>
        <div className="theme-tabs-grid">
          {theme.tabs.map((tab, index) => (
            <div key={tab.key} className="theme-tab-editor">
              <strong>{tab.key}</strong>
              <label>
                Label
                <Input value={tab.label} onChange={(e) => updateTab(index, { label: e.target.value })} />
              </label>
              <label>
                Accent color
                <input type="color" value={tab.color} onChange={(e) => updateTab(index, { color: e.target.value })} />
              </label>
              <label>
                Gradient
                <div className="color-field">
                  <input type="color" value={tab.gradient[0]} onChange={(e) => updateTab(index, { gradient: [e.target.value, tab.gradient[1]] })} />
                  <input type="color" value={tab.gradient[1]} onChange={(e) => updateTab(index, { gradient: [tab.gradient[0], e.target.value] })} />
                </div>
              </label>
            </div>
          ))}
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save theme'}
        </Button>
      </PageCard>
    </div>
  );
}
