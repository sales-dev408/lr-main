import type {
  AdminAnalyticsResponse,
  AdminProfile,
  AdminSettings,
  AuthResponse,
  CardDetailResponse,
  CardSummary,
  ContentBlock,
  ContentKind,
  CreateVendorResult,
  DiscountSummary,
  ThemeSettings,
  TicketRecord,
  VendorActivityRecord,
  VendorPassResult,
  VendorRecord,
} from './types';

const STORAGE_KEY = 'lr.admin.auth';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = 'api_error') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function getBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || '/api';
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function getStoredToken(): string | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

export function getStoredProfile<T>(): T | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw).profile ?? null;
  } catch {
    return null;
  }
}

export function setStoredAuth<T>(auth: { token: string; profile: T }): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearStoredAuth(): void {
  localStorage.removeItem(STORAGE_KEY);
}

async function parseResponseError(response: Response): Promise<{ code: string; message: string }> {
  try {
    const body = (await response.json()) as unknown;
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const error = (body as { error: unknown }).error;
      if (typeof error === 'string') {
        return { code: 'api_error', message: error };
      }
      if (typeof error === 'object' && error !== null) {
        const err = error as { code?: unknown; message?: unknown };
        return {
          code: typeof err.code === 'string' ? err.code : 'api_error',
          message: typeof err.message === 'string' ? err.message : response.statusText || 'Request failed',
        };
      }
    }
    return { code: 'api_error', message: response.statusText || 'Request failed' };
  } catch {
    return { code: 'api_error', message: response.statusText || 'Request failed' };
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  const token = getStoredToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${getBaseUrl()}${normalizePath(path)}`, {
      ...init,
      headers,
    });
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : 'API unreachable', 0, 'network_error');
  }

  if (!response.ok) {
    const parsed = await parseResponseError(response);
    throw new ApiError(parsed.message, response.status, parsed.code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function jsonBody(body: unknown): string {
  return JSON.stringify(body);
}

export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeDiscount(input: Record<string, unknown>): DiscountSummary {
  return {
    id: String(input.id),
    cardId: String(input.cardId ?? input.card_id ?? ''),
    vendorId: String(input.vendorId ?? input.vendor_id ?? ''),
    type: String(input.type) as DiscountSummary['type'],
    value: toNumber(input.value),
    min_purchase: toNumber(input.min_purchase ?? input.minPurchase),
    max_uses_total: toNullableNumber(input.max_uses_total ?? input.maxUsesTotal),
    max_uses_per_customer: toNullableNumber(input.max_uses_per_customer ?? input.maxUsesPerCustomer),
    uses_count: toNumber(input.uses_count ?? input.usesCount),
    city_overrides: (input.city_overrides ?? input.cityOverrides ?? {}) as DiscountSummary['city_overrides'],
    active: Boolean(input.active),
    applied: isRecord(input.applied)
      ? {
          type: String(input.applied.type) as NonNullable<DiscountSummary['applied']>['type'],
          value: toNumber(input.applied.value),
          description: String(input.applied.description ?? ''),
          instruction: typeof input.applied.instruction === 'string' ? input.applied.instruction : undefined,
        }
      : undefined,
  };
}

function normalizeCard(input: Record<string, unknown>): CardSummary {
  const rawLayout = String(input.layout ?? input.layout ?? 'qr_bottom').trim();
  const layout: CardSummary['layout'] =
    rawLayout === 'qr_top' || rawLayout === 'qr_bottom' || rawLayout === 'qr_left' || rawLayout === 'qr_right' ? rawLayout : 'qr_bottom';
  return {
    id: String(input.id),
    name: String(input.name),
    theme: String(input.theme) as CardSummary['theme'],
    description: (input.description as string | null | undefined) ?? null,
    image_url: (input.image_url as string | null | undefined) ?? (input.imageUrl as string | null | undefined) ?? null,
    logo_url: (input.logo_url as string | null | undefined) ?? (input.logoUrl as string | null | undefined) ?? null,
    icon_url: (input.icon_url as string | null | undefined) ?? (input.iconUrl as string | null | undefined) ?? null,
    primary_color: (input.primary_color as string | null | undefined) ?? (input.primaryColor as string | null | undefined) ?? null,
    secondary_color: (input.secondary_color as string | null | undefined) ?? (input.secondaryColor as string | null | undefined) ?? null,
    qr_size: (input.qr_size as number | null | undefined) ?? (input.qrSize as number | null | undefined) ?? null,
    layout,
    expiration_date: (input.expiration_date as string | null | undefined) ?? (input.expirationDate as string | null | undefined) ?? null,
    max_uses: (input.max_uses as number | null | undefined) ?? (input.maxUses as number | null | undefined) ?? null,
    status: String(input.status) as CardSummary['status'],
    participatingBusinesses: Array.isArray(input.participatingBusinesses)
      ? input.participatingBusinesses.map((business) => {
          const row = business as Record<string, unknown>;
          return {
            id: String(row.id),
            name: String(row.name),
            city: (row.city as string | null | undefined) ?? null,
            discount: row.discount && isRecord(row.discount) ? normalizeDiscount(row.discount) : null,
          };
        })
      : undefined,
  };
}

export async function loginAdmin(body: {
  email: string;
  password: string;
}): Promise<AuthResponse<AdminProfile>> {
  return apiRequest<AuthResponse<AdminProfile>>('/auth/admin/login', {
    method: 'POST',
    body: jsonBody(body),
  });
}

export async function getAdminSettings(): Promise<AdminSettings> {
  return apiRequest<AdminSettings>('/admin/settings');
}

export async function updateAdminSettings(body: {
  email?: string;
  password?: string;
  location?: string;
}): Promise<AdminSettings> {
  return apiRequest<AdminSettings>('/admin/settings', { method: 'PATCH', body: jsonBody(body) });
}

export async function getAdminAnalytics(params: { from?: string; to?: string; city?: string }): Promise<AdminAnalyticsResponse> {
  return apiRequest<AdminAnalyticsResponse>(`/admin/analytics${buildQuery(params)}`);
}

export async function listAdminVendors(params: { status?: string; city?: string; category?: string }): Promise<VendorRecord[]> {
  return apiRequest<VendorRecord[]>(`/admin/vendors${buildQuery(params)}`);
}

export async function createAdminVendor(body: {
  name: string;
  address?: string;
  category: 'Sports' | 'Dining' | 'Entertainment';
  email?: string;
  phone?: string;
  discountType: 'fixed' | 'percent' | 'bogo';
  discountValue: number;
  iconDataUrl?: string;
  logoDataUrl?: string;
}): Promise<CreateVendorResult> {
  return apiRequest('/admin/vendors', { method: 'POST', body: jsonBody(body) });
}

export async function updateAdminVendor(
  id: string,
  body: { name?: string; address?: string; category?: 'Sports' | 'Dining' | 'Entertainment'; email?: string; phone?: string; status?: string },
): Promise<VendorRecord> {
  return apiRequest(`/admin/vendors/${id}`, { method: 'PATCH', body: jsonBody(body) });
}

export async function getVendorPass(id: string): Promise<VendorPassResult> {
  return apiRequest(`/admin/vendors/${id}/pass`);
}

export async function regenerateVendorQr(id: string): Promise<{ discountCode: string; qrUrl: string }> {
  return apiRequest(`/admin/vendors/${id}/qr`, { method: 'POST' });
}

export async function getVendorActivity(id: string): Promise<VendorActivityRecord[]> {
  return apiRequest(`/admin/vendors/${id}/activity`);
}

export async function listAdminCards(): Promise<CardSummary[]> {
  const cards = await apiRequest<Array<Record<string, unknown>>>('/admin/cards');
  return cards.map((card) => normalizeCard(card));
}

export async function getCard(id: string): Promise<CardDetailResponse> {
  const card = await apiRequest<Record<string, unknown>>(`/admin/cards/${id}`);
  return normalizeCard(card) as CardDetailResponse;
}

export async function createCard(body: {
  name: string;
  theme: string;
  description?: string;
  imageUrl?: string;
  logoUrl?: string;
  iconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  qrSize?: number;
  layout?: string;
  expirationDate?: string;
  maxUses?: number;
  status?: string;
}): Promise<{ id: string }> {
  return apiRequest('/admin/cards', { method: 'POST', body: jsonBody(body) });
}

export async function updateCard(id: string, body: Partial<Record<string, unknown>>): Promise<Record<string, unknown>> {
  return apiRequest(`/admin/cards/${id}`, { method: 'PATCH', body: jsonBody(body) });
}

export async function deleteCard(id: string): Promise<unknown> {
  return apiRequest(`/admin/cards/${id}`, { method: 'DELETE' });
}

export async function addCardVendor(cardId: string, vendorId: string): Promise<unknown> {
  return apiRequest(`/admin/cards/${cardId}/vendors`, { method: 'POST', body: jsonBody({ vendorId }) });
}

export async function removeCardVendor(cardId: string, vendorId: string): Promise<unknown> {
  return apiRequest(`/admin/cards/${cardId}/vendors/${vendorId}`, { method: 'DELETE' });
}

export async function createDiscount(body: {
  cardId: string;
  vendorId: string;
  type: string;
  value: number;
  minPurchase?: number;
  maxUsesTotal?: number;
  maxUsesPerCustomer?: number;
  cityOverrides?: Record<string, { type?: string; value?: number }>;
  active?: boolean;
}): Promise<{ id: string }> {
  return apiRequest('/admin/discounts', { method: 'POST', body: jsonBody(body) });
}

export async function updateDiscount(id: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return apiRequest(`/admin/discounts/${id}`, { method: 'PATCH', body: jsonBody(body) });
}

export async function deleteDiscount(id: string): Promise<unknown> {
  return apiRequest(`/admin/discounts/${id}`, { method: 'DELETE' });
}

// ---- Event tickets -------------------------------------------------------

export async function listAdminTickets(): Promise<TicketRecord[]> {
  return apiRequest<TicketRecord[]>('/admin/tickets');
}

export async function createAdminTicket(body: { barcode: string; name: string; allowedUses?: number; userId?: string }): Promise<{ id: string }> {
  return apiRequest('/admin/tickets', { method: 'POST', body: jsonBody(body) });
}

export async function updateAdminTicket(
  id: string,
  body: Partial<{ name: string; allowedUses: number; usedUses: number; status: 'active' | 'used' | 'disabled'; userId: string | null }>,
): Promise<TicketRecord> {
  return apiRequest(`/admin/tickets/${id}`, { method: 'PATCH', body: jsonBody(body) });
}

export async function deleteAdminTicket(id: string): Promise<unknown> {
  return apiRequest(`/admin/tickets/${id}`, { method: 'DELETE' });
}

// ---- CMS content ---------------------------------------------------------

export async function listContent(): Promise<ContentBlock[]> {
  return apiRequest<ContentBlock[]>('/admin/content');
}

export async function createContent(body: {
  kind: ContentKind;
  title: string;
  body?: string;
  url?: string;
  dataUrl?: string;
  position?: number;
  published?: boolean;
}): Promise<ContentBlock> {
  return apiRequest('/admin/content', { method: 'POST', body: jsonBody(body) });
}

export async function updateContent(
  id: string,
  body: Partial<{ kind: ContentKind; title: string; body: string; url: string; dataUrl: string; position: number; published: boolean }>,
): Promise<ContentBlock> {
  return apiRequest(`/admin/content/${id}`, { method: 'PATCH', body: jsonBody(body) });
}

export async function deleteContent(id: string): Promise<{ deleted: boolean }> {
  return apiRequest(`/admin/content/${id}`, { method: 'DELETE' });
}

// ---- Theme ---------------------------------------------------------------

export async function getTheme(): Promise<ThemeSettings> {
  return apiRequest<ThemeSettings>('/admin/settings/theme');
}

export async function saveTheme(theme: ThemeSettings): Promise<ThemeSettings> {
  return apiRequest<ThemeSettings>('/admin/settings/theme', { method: 'PATCH', body: jsonBody(theme) });
}

// ---- Events RSS feeds ------------------------------------------------------

export async function getEventsRssUrls(): Promise<{ urls: string[] }> {
  return apiRequest<{ urls: string[] }>('/admin/events');
}

export async function saveEventsRssUrls(urls: string[]): Promise<{ urls: string[] }> {
  return apiRequest<{ urls: string[] }>('/admin/events', { method: 'PATCH', body: jsonBody({ urls }) });
}

// Reads a File into a base64 data URL for upload via the content API.
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
