import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { createAdminVendor, getVendorPass, listAdminVendors, regenerateVendorQr, updateAdminVendor } from '../lib/api';
import type { CreateVendorResult, VendorCategory, VendorPassResult, VendorRecord } from '../lib/types';
import { Button, EmptyState, ErrorBanner, Modal, PageCard, Select, Input, Badge, SuccessBanner } from '../components/Ui';
import { useAuth } from '../lib/auth';
import { parseVendorFields, scanImageToText } from '../lib/ocr';
import { qrCodeUrl } from '../lib/qr';

const CATEGORIES: VendorCategory[] = ['Sports', 'Dining', 'Entertainment'];

const blankVendor = {
  name: '',
  address: '',
  email: '',
  phone: '',
  category: 'Dining' as VendorCategory,
  latitude: '',
  longitude: '',
  discountKind: 'percent' as 'percent' | 'fixed',
  discountValue: '',
  iconDataUrl: '',
  logoDataUrl: '',
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function VendorsPage() {
  const { profile } = useAuth();
  const readOnly = profile?.role === 'analyst';
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [filters, setFilters] = useState({ status: '', category: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<VendorRecord | null>(null);
  const [form, setForm] = useState(blankVendor);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<CreateVendorResult | null>(null);
  const [passView, setPassView] = useState<{ vendor: VendorRecord; pass: VendorPassResult } | null>(null);
  const [qrResult, setQrResult] = useState<{ vendor: VendorRecord; discountCode: string; qrUrl: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminVendors({
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.category ? { category: filters.category } : {}),
      });
      setVendors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load vendors');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [filters.status, filters.category]);

  const sorted = useMemo(() => vendors.slice().sort((a, b) => a.name.localeCompare(b.name)), [vendors]);

  function formatDiscount(type: VendorRecord['discount_type'], value: VendorRecord['discount_value']): string {
    if (!type || value === undefined || value === null) return '';
    const num = typeof value === 'string' ? Number(value) : value;
    if (type === 'percent') return `${num}% off`;
    if (type === 'fixed') return `$${num.toFixed(2)} off`;
    if (type === 'bogo') return 'Buy one, get one';
    return String(value);
  }

  function csvEscape(value: unknown): string {
    const str = value === null || value === undefined ? '' : String(value);
    const escaped = str.replace(/"/g, '""');
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${escaped}"`;
    }
    return escaped;
  }

  function downloadVendorsCsv(items: VendorRecord[]) {
    const headers = ['Business Name', 'Email', 'Phone', 'Address', 'Category', 'Status', 'Discount', 'Discount Code'];
    const rows = items.map((v) => [
      v.name,
      v.email ?? '',
      v.phone ?? '',
      v.address ?? v.location ?? '',
      v.category ?? '',
      v.status,
      formatDiscount(v.discount_type, v.discount_value),
      v.discount_code ?? '',
    ]);
    const csv = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendors-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>, key: 'iconDataUrl' | 'logoDataUrl') {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setForm((prev) => ({ ...prev, [key]: dataUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read image');
    }
  }

  async function handleScan(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setScanning(true);
    setScanNote(null);
    setError(null);
    try {
      const text = await scanImageToText(file);
      const fields = parseVendorFields(text);
      const filled = Object.entries(fields).filter(([, v]) => v);
      if (filled.length === 0) {
        setScanNote('No fields detected — enter details manually.');
        return;
      }
      setForm((prev) => ({
        ...prev,
        ...(fields.name ? { name: fields.name } : {}),
        ...(fields.address ? { address: fields.address } : {}),
        ...(fields.category ? { category: fields.category } : {}),
        ...(fields.discountKind ? { discountKind: fields.discountKind } : {}),
        ...(fields.discountValue ? { discountValue: fields.discountValue } : {}),
      }));
      setScanNote(`Scanned ${filled.map(([k]) => k).join(', ')}. Review before creating.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    const value = Number(form.discountValue);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a valid discount amount.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await createAdminVendor({
        name: form.name,
        address: form.address || undefined,
        category: form.category,
        email: form.email || undefined,
        phone: form.phone || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        discountType: form.discountKind,
        discountValue: value,
        ...(form.iconDataUrl ? { iconDataUrl: form.iconDataUrl } : {}),
        ...(form.logoDataUrl ? { logoDataUrl: form.logoDataUrl } : {}),
      });
      setResult(created);
      setForm(blankVendor);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  async function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || !editing) return;
    try {
      await updateAdminVendor(editing.id, {
        name: editing.name,
        address: editing.address ?? undefined,
        category: (editing.category as VendorCategory | null) ?? undefined,
        email: editing.email ?? undefined,
        phone: editing.phone ?? undefined,
        latitude: editing.latitude ?? undefined,
        longitude: editing.longitude ?? undefined,
        status: editing.status,
      });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function handleViewPass(vendor: VendorRecord) {
    try {
      const pass = await getVendorPass(vendor.id);
      setPassView({ vendor, pass });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load pass');
    }
  }

  async function handleRegenerateQr(vendor: VendorRecord) {
    if (readOnly) return;
    try {
      const { discountCode, qrUrl } = await regenerateVendorQr(vendor.id);
      setQrResult({ vendor, discountCode, qrUrl });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to regenerate QR code');
    }
  }

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Vendors</h1>
          <p className="muted">Create vendors and issue their Apple Wallet discount passes.</p>
        </div>
        <div className="filters">
          <Select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="">All statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </Select>
          <Select value={filters.category} onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <div className="grid-2">
        <PageCard title="Create vendor" subtitle={readOnly ? 'Read-only analyst mode' : 'Add a business and generate its discount pass.'}>
          <form className="form" onSubmit={submitCreate}>
            <div className="scan-box">
              <div>
                <strong>Scan a flyer or business card</strong>
                <p className="muted">Upload a photo and we&apos;ll auto-fill the fields below (OCR by Puter.js). Review before creating.</p>
              </div>
              <label className="btn btn-secondary scan-btn">
                {scanning ? 'Scanning…' : 'Scan image'}
                <input type="file" accept="image/*" disabled={readOnly || scanning} onChange={handleScan} hidden />
              </label>
            </div>
            {scanNote ? <SuccessBanner message={scanNote} /> : null}
            <label>
              Vendor name
              <Input placeholder="Vendor name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
            </label>
            <label>
              Address
              <Input placeholder="Address" value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
            </label>
            <div className="inline-row">
              <label>
                Latitude
                <Input type="number" step="any" placeholder="33.45" value={form.latitude} onChange={(e) => setForm((prev) => ({ ...prev, latitude: e.target.value }))} />
              </label>
              <label>
                Longitude
                <Input type="number" step="any" placeholder="-112.07" value={form.longitude} onChange={(e) => setForm((prev) => ({ ...prev, longitude: e.target.value }))} />
              </label>
            </div>
            <label>
              Category
              <Select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as VendorCategory }))}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Email address
              <Input type="email" placeholder="vendor@example.com" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </label>
            <label>
              Phone number
              <Input type="tel" placeholder="(602) 555-1234" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
            </label>
            <label>
              Discount amount
              <div className="inline-row">
                <Select value={form.discountKind} onChange={(e) => setForm((prev) => ({ ...prev, discountKind: e.target.value as 'percent' | 'fixed' }))}>
                  <option value="percent">%</option>
                  <option value="fixed">$</option>
                </Select>
                <Input type="number" min="0" step="0.01" placeholder="15" value={form.discountValue} onChange={(e) => setForm((prev) => ({ ...prev, discountValue: e.target.value }))} required />
              </div>
            </label>
            <label>
              Icon PNG
              <Input type="file" accept="image/png" onChange={(e) => handleFile(e, 'iconDataUrl')} />
            </label>
            <label>
              Logo PNG
              <Input type="file" accept="image/png" onChange={(e) => handleFile(e, 'logoDataUrl')} />
            </label>
            <Button type="submit" disabled={readOnly || creating}>
              {creating ? 'Creating…' : 'Create vendor'}
            </Button>
          </form>
        </PageCard>

        <PageCard title="Vendors list">
          <div className="row-actions" style={{ justifyContent: 'flex-end', paddingBottom: 12 }}>
            <Button variant="secondary" onClick={() => downloadVendorsCsv(sorted)} disabled={sorted.length === 0}>
              Export CSV
            </Button>
          </div>
          {loading ? <div className="muted">Loading…</div> : null}
          {sorted.length === 0 ? <EmptyState title="No vendors" description="Use the create form to add vendors." /> : null}
          <div className="vendor-list">
            {sorted.map((vendor) => (
              <article key={vendor.id} className="list-row">
                <div>
                  <strong>{vendor.name}</strong>
                  <p className="muted">
                    {(vendor.address ?? vendor.location) ?? '—'} · {vendor.category ?? '—'}
                    {vendor.email ? ` · ${vendor.email}` : ''}
                    {vendor.phone ? ` · ${vendor.phone}` : ''}
                  </p>
                  <Badge tone={vendor.status === 'approved' ? 'success' : vendor.status === 'rejected' ? 'danger' : 'warning'}>{vendor.status}</Badge>
                </div>
                <div className="row-actions">
                  <Button variant="secondary" disabled={readOnly} onClick={() => setEditing(vendor)}>
                    Edit
                  </Button>
                  <Button variant="secondary" disabled={readOnly} onClick={() => handleRegenerateQr(vendor)}>
                    Regenerate QR
                  </Button>
                  <Button variant="secondary" onClick={() => handleViewPass(vendor)}>
                    View discount
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </PageCard>
      </div>

      <Modal open={Boolean(result)} title="Vendor created" onClose={() => setResult(null)}>
        {result ? (
          <div className="stack">
            <SuccessBanner message={`"${result.vendor.name}" added to the ${result.membershipCard.name} with a ${result.discount.label} member discount.`} />
            <div>
              <p className="muted">Exclusive member discount</p>
              <pre className="code-block">{result.discount.label}</pre>
            </div>
            <div>
              <p className="muted">POS discount code</p>
              <pre className="code-block">{result.discountCode}</pre>
            </div>
            <div>
              <p className="muted">Printable in-store QR code</p>
              <img src={qrCodeUrl(result.discountCode, 240)} alt="Vendor QR code" style={{ width: 240, height: 240, borderRadius: 12 }} />
            </div>
            <div>
              <p className="muted">Merchant POS activation instructions</p>
              <pre className="code-block">{result.posInstructions}</pre>
            </div>
            <p className="muted">
              Members carry one all-in-one membership pass. This vendor&apos;s discount is applied when a member scans this
              QR code in the app — no per-vendor pass is generated.
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(passView)} title={`Discount: ${passView?.vendor.name ?? ''}`} onClose={() => setPassView(null)}>
        {passView ? (
          <div className="stack">
            <div>
              <p className="muted">Exclusive member discount</p>
              <pre className="code-block">{passView.pass.discount.label}</pre>
            </div>
            <div>
              <p className="muted">POS discount code</p>
              <pre className="code-block">{passView.pass.discountCode ?? '—'}</pre>
            </div>
            <div>
              <p className="muted">Membership card</p>
              <pre className="code-block">{passView.pass.membershipCard.name}</pre>
            </div>
            <div>
              <p className="muted">POS instructions</p>
              <pre className="code-block">{passView.pass.posInstructions}</pre>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(qrResult)} title={`QR code: ${qrResult?.vendor.name ?? ''}`} onClose={() => setQrResult(null)}>
        {qrResult ? (
          <div className="stack">
            <SuccessBanner message="A new QR code and discount code have been generated for this vendor." />
            <div>
              <p className="muted">New POS discount code</p>
              <pre className="code-block">{qrResult.discountCode}</pre>
            </div>
            <div>
              <p className="muted">Printable QR code</p>
              <img src={qrResult.qrUrl} alt="Vendor QR code" style={{ width: 240, height: 240, borderRadius: 12 }} />
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(editing)} title="Edit vendor" onClose={() => setEditing(null)}>
        {editing ? (
          <form className="form" onSubmit={submitUpdate}>
            <label>
              Name
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <label>
              Address
              <Input value={editing.address ?? ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
            </label>
            <div className="inline-row">
              <label>
                Latitude
                <Input type="number" step="any" value={editing.latitude ?? ''} onChange={(e) => setEditing({ ...editing, latitude: e.target.value ? Number(e.target.value) : null })} />
              </label>
              <label>
                Longitude
                <Input type="number" step="any" value={editing.longitude ?? ''} onChange={(e) => setEditing({ ...editing, longitude: e.target.value ? Number(e.target.value) : null })} />
              </label>
            </div>
            <label>
              Category
              <Select value={editing.category ?? 'Dining'} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Email
              <Input type="email" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </label>
            <label>
              Phone
              <Input type="tel" value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </label>
            <label>
              Status
              <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as VendorRecord['status'] })}>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="suspended">Suspended</option>
              </Select>
            </label>
            <Button type="submit" disabled={readOnly}>
              Save
            </Button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
