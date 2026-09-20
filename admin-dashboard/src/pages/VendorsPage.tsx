import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  createAdminVendor,
  getVendorAnalytics,
  listAdminStops,
  listAdminVendors,
  regenerateVendorQr,
  updateAdminVendor,
} from '../lib/api';
import type { StopRecord, VendorCategory, VendorRecord } from '../lib/types';
import type { VendorAnalyticsResponse } from '../lib/api';
import { AddressAutofill } from '@mapbox/search-js-react';
import type { AddressAutofillRetrieveResponse } from '@mapbox/search-js-core';
import { Button, EmptyState, ErrorBanner, InfoCard, Modal, PageCard, Select, Input, Textarea, Badge, SuccessBanner } from '../components/Ui';
import { useAuth } from '../lib/auth';
import { parseVendorFields, scanImageToText } from '../lib/ocr';
import { qrCodeUrl } from '../lib/qr';

const mapboxToken = (import.meta.env as Record<string, string | undefined>).VITE_MAPBOX_ACCESS_TOKEN;

async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  if (!mapboxToken || !address.trim()) return null;
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&limit=1`,
  );
  if (!response.ok) return null;
  const data = (await response.json()) as { features?: Array<{ center: [number, number] }> };
  const feature = data.features?.[0];
  if (!feature?.center) return null;
  const [longitude, latitude] = feature.center;
  return { latitude, longitude };
}

const CATEGORIES: VendorCategory[] = ['Sports', 'Dining', 'Entertainment'];

type DiscountKind = 'percent' | 'fixed' | 'bogo';

const DEFAULT_DISCOUNT_TERMS = 'Cannot be applied with any other offer\nNot redeemable for cash\nCan be used 1 time per week';

const blankVendor = {
  name: '',
  ownerName: '',
  address: '',
  station: '',
  latitude: '',
  longitude: '',
  email: '',
  phone: '',
  category: 'Dining' as VendorCategory,
  discountKind: 'percent' as DiscountKind,
  discountValue: '',
  discountDescription: '',
  discountTerms: DEFAULT_DISCOUNT_TERMS,
  discountStartsAt: '',
  discountEndsAt: '',
  boosted: false,
  iconDataUrl: '',
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function formatDiscount(type: VendorRecord['discount_type'], value: VendorRecord['discount_value']): string {
  if (!type) return '';
  if (type === 'bogo') return 'Buy one, get one';
  if (value === undefined || value === null) return '';
  const num = typeof value === 'string' ? Number(value) : value;
  if (type === 'percent') return `${num}% off`;
  if (type === 'fixed') return `$${num.toFixed(2)} off`;
  return String(value);
}

function formatFlashWindow(starts: VendorRecord['discount_starts_at'], ends: VendorRecord['discount_ends_at']): string | null {
  if (!starts && !ends) return null;
  const start = starts ? new Date(starts).toLocaleString() : 'now';
  const end = ends ? new Date(ends).toLocaleString() : 'ongoing';
  return `Flash deal: ${start} → ${end}`;
}

function toLocalDatetime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const name = (fullName ?? '').trim();
  if (!name) return { firstName: '', lastName: '' };
  const parts = name.split(/\s+/);
  const firstName = parts[0] ?? '';
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

function parseAddress(raw: string | null | undefined) {
  const address = (raw ?? '').trim();
  const parts = address.split(',').map((part) => part.trim());
  const street = parts[0] ?? '';
  const city = parts[1] ?? '';
  const stateZip = parts[2] ?? '';
  const stateZipParts = stateZip.split(/\s+/).filter(Boolean);
  const state = stateZipParts[0] ?? '';
  const zip = stateZipParts.slice(1).join(' ');
  return { street, city, state, zip };
}

function csvEscape(value: string): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ---- JSON import helpers ---------------------------------------------------

// Canonical field -> accepted aliases (compared case- and punctuation-insensitively).
const VENDOR_FIELD_ALIASES: Record<keyof ParsedVendorRow, string[]> = {
  name: ['name', 'business', 'businessname', 'company', 'vendor', 'vendorname'],
  ownerName: ['owner', 'ownername', 'contact', 'contactname'],
  address: ['address', 'location', 'street', 'streetaddress'],
  station: ['station', 'stop', 'trainstop', 'stopname'],
  category: ['category', 'type', 'businesstype'],
  email: ['email', 'emailaddress'],
  phone: ['phone', 'phonenumber', 'tel', 'telephone'],
  latitude: ['latitude', 'lat', 'latcoord'],
  longitude: ['longitude', 'lon', 'lng', 'long', 'longcoord'],
  discountType: ['discounttype', 'discount', 'offertype'],
  discountValue: ['discountvalue', 'discountamount', 'value', 'amount'],
  discountDescription: ['discountdescription', 'description', 'details', 'offerdetails'],
};

interface ParsedVendorRow {
  name?: string;
  ownerName?: string;
  address?: string;
  station?: string;
  category?: string;
  email?: string;
  phone?: string;
  latitude?: string;
  longitude?: string;
  discountType?: string;
  discountValue?: string;
  discountDescription?: string;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Build a reverse lookup: normalized alias -> canonical field name.
const VENDOR_ALIAS_LOOKUP: Record<string, keyof ParsedVendorRow> = (() => {
  const map: Record<string, keyof ParsedVendorRow> = {};
  (Object.keys(VENDOR_FIELD_ALIASES) as (keyof ParsedVendorRow)[]).forEach((field) => {
    map[normalizeKey(field)] = field;
    VENDOR_FIELD_ALIASES[field].forEach((alias) => {
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

function parseVendorRows(raw: string): ParsedVendorRow[] {
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
      return (n === 'vendors' || n === 'data' || n === 'items' || n === 'list' || n === 'rows') && Array.isArray(obj[k]);
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
    const row: ParsedVendorRow = {};
    for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
      const field = VENDOR_ALIAS_LOOKUP[normalizeKey(key)];
      if (!field) continue;
      const text = coerceString(value);
      if (text === undefined) continue;
      // Don't overwrite an already-matched canonical field.
      if (row[field] === undefined) row[field] = text;
    }
    return row;
  });
}

function rowToVendorInput(row: ParsedVendorRow): { name: string; ownerName?: string; address?: string; station?: string; category?: string; email?: string; phone?: string; latitude?: number; longitude?: number; discountType?: 'fixed' | 'percent' | 'bogo'; discountValue?: number; discountDescription?: string } | null {
  const name = row.name?.trim();
  if (!name) return null;
  
  const category = row.category?.trim() as VendorCategory | undefined;
  const validCategory = category && CATEGORIES.includes(category) ? category : 'Dining';
  
  const discountType = row.discountType?.trim().toLowerCase() as 'fixed' | 'percent' | 'bogo' | undefined;
  const validDiscountType = (discountType === 'fixed' || discountType === 'percent' || discountType === 'bogo') ? discountType : 'percent';
  
  const discountValue = row.discountValue ? Number(row.discountValue) : undefined;
  const latitude = row.latitude ? Number(row.latitude) : undefined;
  const longitude = row.longitude ? Number(row.longitude) : undefined;
  
  return {
    name,
    ownerName: row.ownerName?.trim() || undefined,
    address: row.address?.trim() || undefined,
    station: row.station?.trim() || undefined,
    category: validCategory,
    email: row.email?.trim() || undefined,
    phone: row.phone?.trim() || undefined,
    latitude: latitude && !isNaN(latitude) ? latitude : undefined,
    longitude: longitude && !isNaN(longitude) ? longitude : undefined,
    discountType: validDiscountType,
    discountValue: discountValue && !isNaN(discountValue) ? discountValue : undefined,
    discountDescription: row.discountDescription?.trim() || undefined,
  };
}

function downloadCsv(vendors: VendorRecord[]) {
  const header = ['Biz Name', 'First Name', 'Last Name', 'Street Address', 'City', 'State', 'Zip Code', 'Phone Number', 'Additional Info'];
  const rows = vendors.map((vendor) => {
    const { firstName, lastName } = parseName(vendor.owner_name);
    const { street, city, state, zip } = parseAddress(vendor.address ?? vendor.location);
    const discount = formatDiscount(vendor.discount_type ?? null, vendor.discount_value ?? null);
    const additional = [vendor.email, vendor.category, discount].filter(Boolean).join(' · ');
    return [vendor.name, firstName, lastName, street, city, state, zip, vendor.phone ?? '', additional];
  });
  const csv = [header.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vendors-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadQrPdf(vendorName: string, code: string, discountLabel: string) {
  const qr = qrCodeUrl(code, 260);
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>QR Code - ${vendorName}</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 32px; }
          h1 { margin: 0 0 12px; font-size: 28px; }
          img { width: 260px; height: 260px; border-radius: 12px; margin: 24px 0; }
          .instructions { max-width: 520px; margin: 0 auto; font-size: 18px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <h1>${vendorName}</h1>
        <img src="${qr}" alt="QR code" />
        <p class="instructions">Light Rail Deals Pass Holders, scan the QR code and present your screen to the vendor to redeem your ${discountLabel}.</p>
      </body>
    </html>
  `;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);
}

export function VendorsPage() {
  const { profile } = useAuth();
  const readOnly = profile?.role === 'analyst';
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [stops, setStops] = useState<StopRecord[]>([]);
  const [filters, setFilters] = useState({ status: '', category: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<VendorRecord | null>(null);
  const [form, setForm] = useState(blankVendor);
  const [creating, setCreating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [statsVendor, setStatsVendor] = useState<{ vendor: VendorRecord; stats: VendorAnalyticsResponse } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  
  // JSON bulk import state
  const [jsonText, setJsonText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; failed: number; errors: string[] } | null>(null);

  function handleAutofillRetrieve(res: AddressAutofillRetrieveResponse) {
    const feature = res.features[0];
    if (!feature) return;
    const [longitude, latitude] = feature.geometry.coordinates;
    const fullAddress =
      feature.properties.full_address ??
      feature.properties.place_name ??
      feature.properties.feature_name ??
      '';
    setForm((prev) => ({
      ...prev,
      address: fullAddress,
      latitude: String(latitude),
      longitude: String(longitude),
    }));
  }

  function handleEditAutofillRetrieve(res: AddressAutofillRetrieveResponse) {
    const feature = res.features[0];
    if (!feature) return;
    const [longitude, latitude] = feature.geometry.coordinates;
    const fullAddress =
      feature.properties.full_address ??
      feature.properties.place_name ??
      feature.properties.feature_name ??
      '';
    setEditing((prev) => (prev ? { ...prev, address: fullAddress, latitude, longitude } : prev));
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [data, stopData] = await Promise.all([
        listAdminVendors({
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.category ? { category: filters.category } : {}),
        }),
        listAdminStops(),
      ]);
      setVendors(data);
      setStops(stopData);
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

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setForm((prev) => ({ ...prev, iconDataUrl: dataUrl }));
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
        ...(fields.discountKind ? { discountKind: fields.discountKind as DiscountKind } : {}),
        ...(fields.discountValue ? { discountValue: fields.discountValue } : {}),
      }));
      setScanNote(`Scanned ${filled.map(([k]) => k).join(', ')}. Review before creating.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  function discountValueRequired(kind: DiscountKind): boolean {
    return kind === 'percent' || kind === 'fixed';
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    const needsValue = discountValueRequired(form.discountKind);
    const value = Number(form.discountValue);
    if (needsValue && (!Number.isFinite(value) || value <= 0)) {
      setError('Enter a valid discount amount.');
      return;
    }
    if (form.discountKind === 'bogo' && !form.discountDescription.trim()) {
      setError('BOGO discounts require a description.');
      return;
    }
    const latitude = form.latitude.trim() ? Number(form.latitude) : undefined;
    const longitude = form.longitude.trim() ? Number(form.longitude) : undefined;
    if ((form.latitude.trim() && !Number.isFinite(latitude)) || (form.longitude.trim() && !Number.isFinite(longitude))) {
      setError('Enter valid latitude and longitude values.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createAdminVendor({
        name: form.name,
        ownerName: form.ownerName || undefined,
        address: form.address || undefined,
        station: form.station || null,
        latitude,
        longitude,
        category: form.category,
        email: form.email || undefined,
        phone: form.phone || undefined,
        discountType: form.discountKind,
        discountValue: needsValue ? value : 0,
        discountDescription: form.discountDescription.trim() || null,
        discountTerms: form.discountTerms.trim() || DEFAULT_DISCOUNT_TERMS,
        discountStartsAt: form.discountStartsAt ? new Date(form.discountStartsAt).toISOString() : null,
        discountEndsAt: form.discountEndsAt ? new Date(form.discountEndsAt).toISOString() : null,
        boosted: form.boosted,
        ...(form.iconDataUrl ? { iconDataUrl: form.iconDataUrl } : {}),
      });
      setForm(blankVendor);
      setScanNote('Vendor created successfully.');
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
      const kind = editing.discount_type ?? 'percent';
      const needsValue = discountValueRequired(kind as DiscountKind);
      const rawValue = editing.discount_value;
      const value = rawValue !== undefined && rawValue !== null && rawValue !== '' ? Number(rawValue) : null;
      if (kind === 'bogo' && !editing.discount_description?.trim()) {
        setError('BOGO discounts require a description.');
        return;
      }
      await updateAdminVendor(editing.id, {
        name: editing.name,
        ownerName: editing.owner_name ?? undefined,
        address: editing.address ?? editing.location ?? undefined,
        station: editing.station ?? null,
        latitude: editing.latitude ?? undefined,
        longitude: editing.longitude ?? undefined,
        category: (editing.category as VendorCategory | null) ?? undefined,
        email: editing.email ?? undefined,
        phone: editing.phone ?? undefined,
        status: editing.status,
        ...(editing.discount_type ? { discountType: editing.discount_type } : {}),
        ...(needsValue && value !== null ? { discountValue: value } : {}),
        discountDescription: editing.discount_description?.trim() || null,
        discountTerms: editing.discount_terms?.trim() || DEFAULT_DISCOUNT_TERMS,
        discountStartsAt: editing.discount_starts_at ? new Date(editing.discount_starts_at).toISOString() : null,
        discountEndsAt: editing.discount_ends_at ? new Date(editing.discount_ends_at).toISOString() : null,
        boosted: editing.boosted ?? false,
      });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function handleRegenerateQr(vendor: VendorRecord) {
    if (readOnly) return;
    try {
      setError(null);
      const { discountCode } = await regenerateVendorQr(vendor.id);
      await load();
      const discountType = vendor.discount_type ?? 'percent';
      const value = typeof vendor.discount_value === 'string' ? Number(vendor.discount_value) : (vendor.discount_value ?? 0);
      const label = formatDiscount(discountType, value);
      downloadQrPdf(vendor.name, discountCode, label);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to regenerate QR code');
    }
  }

  async function handleViewStats(vendor: VendorRecord) {
    setStatsLoading(true);
    setStatsVendor(null);
    setError(null);
    try {
      const stats = await getVendorAnalytics(vendor.id);
      setStatsVendor({ vendor, stats });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load vendor stats');
    } finally {
      setStatsLoading(false);
    }
  }

  async function handleImportJson() {
    setError(null);
    setImportResult(null);
    if (!jsonText.trim()) {
      setError('Paste a JSON array of vendors first.');
      return;
    }
    let rows: ParsedVendorRow[];
    try {
      rows = parseVendorRows(jsonText);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to parse JSON');
      return;
    }
    if (rows.length === 0) {
      setError('No vendor rows found in the JSON.');
      return;
    }

    setImporting(true);
    let created = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const input = rowToVendorInput(rows[i]!);
      if (!input) {
        skipped++;
        errors.push(`Row ${i + 1}: skipped (no name).`);
        continue;
      }
      
      // Auto-geocode if address is provided but coordinates are missing
      let latitude = input.latitude;
      let longitude = input.longitude;
      if (input.address && (!latitude || !longitude) && mapboxToken) {
        try {
          const coords = await geocodeAddress(input.address);
          if (coords) {
            latitude = coords.latitude;
            longitude = coords.longitude;
          }
        } catch (err) {
          console.warn(`Failed to geocode ${input.name}:`, err);
        }
      }
      
      try {
        await createAdminVendor({
          name: input.name,
          ownerName: input.ownerName,
          address: input.address,
          station: input.station,
          category: input.category as 'Sports' | 'Dining' | 'Entertainment',
          email: input.email,
          phone: input.phone,
          latitude,
          longitude,
          discountType: input.discountType || 'percent',
          discountValue: input.discountValue || 0,
          discountDescription: input.discountDescription,
          discountTerms: DEFAULT_DISCOUNT_TERMS,
        });
        created++;
      } catch (err) {
        failed++;
        errors.push(`Row ${i + 1} ("${input.name}"): ${err instanceof Error ? err.message : 'failed'}`);
      }
    }

    setImportResult({ created, skipped, failed, errors: errors.slice(0, 20) });
    if (failed === 0 && created > 0) {
      await load();
      setJsonText('');
    }
    setImporting(false);
  }

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Vendors</h1>
          <p className="muted">Create vendors and manage their discount offers.</p>
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
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Button variant="secondary" onClick={() => downloadCsv(sorted)}>Export to CSV</Button>
          <Button variant="secondary" onClick={() => { setJsonText(''); setImportResult(null); }}>Clear import</Button>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <div className="grid-2">
        <PageCard title="Create vendor" subtitle={readOnly ? 'Read-only analyst mode' : 'Scan a flyer or enter business details.'}>
          <form className="form" onSubmit={submitCreate}>
            <div className="scan-box">
              <div>
                <strong>Scan a flyer or business card</strong>
                <p className="muted">Upload a photo to auto-fill fields below.</p>
              </div>
              <label className="btn btn-secondary scan-btn">
                {scanning ? 'Scanning…' : 'Scan image'}
                <input type="file" accept="image/*" disabled={readOnly || scanning} onChange={handleScan} hidden />
              </label>
            </div>
            {scanNote ? <SuccessBanner message={scanNote} /> : null}
            <label>
              Business name
              <Input placeholder="Business name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
            </label>
            <label>
              Owner name
              <Input placeholder="Owner name" value={form.ownerName} onChange={(e) => setForm((prev) => ({ ...prev, ownerName: e.target.value }))} />
            </label>
            <label>
              Address
              {mapboxToken ? (
                <AddressAutofill accessToken={mapboxToken} onRetrieve={handleAutofillRetrieve}>
                  <Input
                    autoComplete="address-line1"
                    placeholder="Address"
                    value={form.address}
                    onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  />
                </AddressAutofill>
              ) : (
                <Input
                  autoComplete="address-line1"
                  placeholder="Address"
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                />
              )}
            </label>
            <label>
              Station
              <Select value={form.station} onChange={(e) => setForm((prev) => ({ ...prev, station: e.target.value }))}>
                <option value="">— Select a stop —</option>
                {stops.map((stop) => (
                  <option key={stop.id} value={stop.name}>{stop.name}</option>
                ))}
              </Select>
            </label>
            <div className="grid-2">
              <label>
                Latitude
                <Input type="number" step="any" placeholder="33.45" value={form.latitude} onChange={(e) => setForm((prev) => ({ ...prev, latitude: e.target.value }))} />
              </label>
              <label>
                Longitude
                <Input type="number" step="any" placeholder="-112.07" value={form.longitude} onChange={(e) => setForm((prev) => ({ ...prev, longitude: e.target.value }))} />
              </label>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={!mapboxToken || !form.address.trim()}
              onClick={async () => {
                const coords = await geocodeAddress(form.address);
                if (coords) {
                  setForm((prev) => ({ ...prev, latitude: String(coords.latitude), longitude: String(coords.longitude) }));
                } else {
                  setError('Unable to look up coordinates. Check the address and Mapbox token.');
                }
              }}
            >
              {mapboxToken ? 'Look up coordinates' : 'Mapbox token missing'}
            </Button>
            <label>
              Category
              <Select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as VendorCategory }))}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
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
                <Select value={form.discountKind} onChange={(e) => setForm((prev) => ({ ...prev, discountKind: e.target.value as DiscountKind }))}>
                  <option value="percent">% off</option>
                  <option value="fixed">$ off</option>
                  <option value="bogo">BOGO</option>
                </Select>
                {discountValueRequired(form.discountKind) ? (
                  <Input type="number" min="0" step="0.01" placeholder="15" value={form.discountValue} onChange={(e) => setForm((prev) => ({ ...prev, discountValue: e.target.value }))} required />
                ) : null}
              </div>
            </label>
            <label>
              Discount description
              <Textarea
                placeholder="Describe the offer (required for BOGO)"
                value={form.discountDescription}
                onChange={(e) => setForm((prev) => ({ ...prev, discountDescription: e.target.value }))}
                rows={2}
              />
            </label>
            <label>
              Terms of discount
              <Textarea
                value={form.discountTerms}
                onChange={(e) => setForm((prev) => ({ ...prev, discountTerms: e.target.value }))}
                rows={4}
              />
            </label>
            <div className="grid-2">
              <label>
                Flash deal starts
                <Input type="datetime-local" value={form.discountStartsAt} onChange={(e) => setForm((prev) => ({ ...prev, discountStartsAt: e.target.value }))} />
              </label>
              <label>
                Flash deal ends
                <Input type="datetime-local" value={form.discountEndsAt} onChange={(e) => setForm((prev) => ({ ...prev, discountEndsAt: e.target.value }))} />
              </label>
            </div>
            <label className="inline-row" style={{ alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.boosted} onChange={(e) => setForm((prev) => ({ ...prev, boosted: e.target.checked }))} />
              Boost this deal
            </label>
            <label>
              Icon
              <Input type="file" accept="image/*" onChange={handleFile} />
              {form.iconDataUrl ? <img src={form.iconDataUrl} alt="Icon preview" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} /> : null}
            </label>
            <Button type="submit" disabled={readOnly || creating}>
              {creating ? 'Creating…' : 'Create vendor'}
            </Button>
          </form>
        </PageCard>

        <PageCard
          title="Import from JSON"
          subtitle="Paste a JSON array of vendors. Column names are case-insensitive (e.g. name, address, station, category, phone, email, discountType, discountValue). Only a name is required; other fields are optional. Addresses are automatically geocoded if coordinates not provided."
        >
          <Textarea
            rows={12}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder={'[\n  {\n    "name": "Joe\'s Pizza",\n    "address": "123 Main St, Phoenix, AZ",\n    "station": "Central Station",\n    "category": "Dining",\n    "phone": "(602) 555-1234",\n    "discountType": "percent",\n    "discountValue": 15\n  }\n]'}
          />
          <div className="inline-row" style={{ marginTop: 12 }}>
            <Button onClick={handleImportJson} disabled={importing || !jsonText.trim() || readOnly}>
              {importing ? 'Importing…' : 'Import vendors'}
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

        <PageCard title="Vendors list">
          {loading ? <div className="muted">Loading…</div> : null}
          {sorted.length === 0 ? <EmptyState title="No vendors" description="Use the create form to add vendors." /> : null}
          <div className="vendor-list">
            {sorted.map((vendor) => (
              <article key={vendor.id} className="list-row">
                <div className="vendor-info">
                  {vendor.icon_url ? <img src={vendor.icon_url} alt="" className="vendor-icon" /> : null}
                  <div>
                    <strong>{vendor.name}</strong>
                    {vendor.owner_name ? <p className="muted">Owner: {vendor.owner_name}</p> : null}
                    <p className="muted">
                      {(vendor.address ?? vendor.location) ?? '—'} · {vendor.category ?? '—'}
                      {vendor.station ? ` · ${vendor.station}` : ''}
                      {vendor.email ? ` · ${vendor.email}` : ''}
                      {vendor.phone ? ` · ${vendor.phone}` : ''}
                    </p>
                    <div className="inline-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <Badge tone={vendor.status === 'approved' ? 'success' : vendor.status === 'rejected' ? 'danger' : 'warning'}>{vendor.status}</Badge>
                      {vendor.boosted ? <Badge tone="info">Boosted</Badge> : null}
                      {vendor.discount_type ? <Badge tone="neutral">{formatDiscount(vendor.discount_type, vendor.discount_value)}</Badge> : null}
                    </div>
                    {formatFlashWindow(vendor.discount_starts_at, vendor.discount_ends_at) ? <p className="muted">{formatFlashWindow(vendor.discount_starts_at, vendor.discount_ends_at)}</p> : null}
                  </div>
                </div>
                <div className="row-actions">
                  <Button variant="secondary" disabled={readOnly} onClick={() => setEditing(vendor)}>Edit</Button>
                  <Button variant="secondary" disabled={readOnly} onClick={() => handleRegenerateQr(vendor)}>Regenerate QR</Button>
                  <Button variant="secondary" onClick={() => handleViewStats(vendor)}>View stats</Button>
                </div>
              </article>
            ))}
          </div>
        </PageCard>
      </div>

      <Modal open={Boolean(editing)} title="Edit vendor" onClose={() => setEditing(null)}>
        {editing ? (
          <form className="form" onSubmit={submitUpdate}>
            <label>
              Business name
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <label>
              Owner name
              <Input value={editing.owner_name ?? ''} onChange={(e) => setEditing({ ...editing, owner_name: e.target.value || null })} />
            </label>
            <label>
              Address
              {mapboxToken ? (
                <AddressAutofill accessToken={mapboxToken} onRetrieve={handleEditAutofillRetrieve}>
                  <Input
                    autoComplete="address-line1"
                    value={editing.address ?? editing.location ?? ''}
                    onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                  />
                </AddressAutofill>
              ) : (
                <Input
                  autoComplete="address-line1"
                  value={editing.address ?? editing.location ?? ''}
                  onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                />
              )}
            </label>
            <label>
              Station
              <Select value={editing.station ?? ''} onChange={(e) => setEditing({ ...editing, station: e.target.value })}>
                <option value="">— Select a stop —</option>
                {stops.map((stop) => (
                  <option key={stop.id} value={stop.name}>{stop.name}</option>
                ))}
              </Select>
            </label>
            <div className="grid-2">
              <label>
                Latitude
                <Input type="number" step="any" placeholder="33.45" value={editing.latitude ?? ''} onChange={(e) => setEditing({ ...editing, latitude: e.target.value ? Number(e.target.value) : null })} />
              </label>
              <label>
                Longitude
                <Input type="number" step="any" placeholder="-112.07" value={editing.longitude ?? ''} onChange={(e) => setEditing({ ...editing, longitude: e.target.value ? Number(e.target.value) : null })} />
              </label>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={!mapboxToken || !(editing.address ?? editing.location ?? '').trim()}
              onClick={async () => {
                const address = editing.address ?? editing.location ?? '';
                const coords = await geocodeAddress(address);
                if (coords) {
                  setEditing({ ...editing, latitude: coords.latitude, longitude: coords.longitude });
                } else {
                  setError('Unable to look up coordinates. Check the address and Mapbox token.');
                }
              }}
            >
              {mapboxToken ? 'Look up coordinates' : 'Mapbox token missing'}
            </Button>
            <label>
              Category
              <Select value={editing.category ?? 'Dining'} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
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
            <label>
              Discount type
              <Select value={editing.discount_type ?? 'percent'} onChange={(e) => setEditing({ ...editing, discount_type: e.target.value as 'fixed' | 'percent' | 'bogo' })}>
                <option value="percent">% off</option>
                <option value="fixed">$ off</option>
                <option value="bogo">BOGO</option>
              </Select>
            </label>
            {(editing.discount_type === 'percent' || editing.discount_type === 'fixed') ? (
              <label>
                Discount value
                <Input type="number" min="0" step="0.01" value={editing.discount_value ?? ''} onChange={(e) => setEditing({ ...editing, discount_value: e.target.value ? Number(e.target.value) : null })} />
              </label>
            ) : null}
            <label>
              Discount description
              <Textarea
                placeholder="Describe the offer (required for BOGO)"
                value={editing.discount_description ?? ''}
                onChange={(e) => setEditing({ ...editing, discount_description: e.target.value })}
                rows={2}
              />
            </label>
            <label>
              Terms of discount
              <Textarea
                value={editing.discount_terms ?? DEFAULT_DISCOUNT_TERMS}
                onChange={(e) => setEditing({ ...editing, discount_terms: e.target.value })}
                rows={4}
              />
            </label>
            <div className="grid-2">
              <label>
                Flash deal starts
                <Input type="datetime-local" value={toLocalDatetime(editing.discount_starts_at)} onChange={(e) => setEditing({ ...editing, discount_starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </label>
              <label>
                Flash deal ends
                <Input type="datetime-local" value={toLocalDatetime(editing.discount_ends_at)} onChange={(e) => setEditing({ ...editing, discount_ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </label>
            </div>
            <label className="inline-row" style={{ alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={Boolean(editing.boosted)} onChange={(e) => setEditing({ ...editing, boosted: e.target.checked })} />
              Boost this deal
            </label>
            <Button type="submit" disabled={readOnly}>Save</Button>
          </form>
        ) : null}
      </Modal>

      <Modal open={Boolean(statsVendor) || statsLoading} title={statsVendor ? `Stats: ${statsVendor.vendor.name}` : 'Loading stats…'} onClose={() => { setStatsVendor(null); setStatsLoading(false); }}>
        {statsVendor ? (
          <div className="stack">
            <div className="stats-grid">
              <InfoCard label="Total redemptions" value={statsVendor.stats.totals.redemptions} />
              <InfoCard label="Unique customers" value={statsVendor.stats.totals.uniqueCustomers} />
            </div>
            {statsVendor.stats.daily.length > 0 ? (
              <PageCard title="Daily redemptions">
                <table className="table">
                  <thead>
                    <tr><th>Day</th><th>Redemptions</th></tr>
                  </thead>
                  <tbody>
                    {statsVendor.stats.daily.map((row) => (
                      <tr key={row.day}>
                        <td>{new Date(row.day).toLocaleDateString()}</td>
                        <td>{row.redemptions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PageCard>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
