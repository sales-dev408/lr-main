// Comprehensive admin-dashboard API test.
// Usage: node scripts/admin-api-test.mjs
// Reads ADMIN_EMAIL / ADMIN_PASSWORD / PORT from backend .env via dotenv.
import 'dotenv/config';

const BASE = `http://localhost:${process.env.PORT || 4000}/api`;
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

const results = [];
const created = { vendors: [], cards: [], discounts: [], users: [], stops: [], apartments: [], realEstate: [], ads: [], content: [], events: [] };
let restored = { theme: null, rssUrls: null, adminLocation: undefined };

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

async function req(method, path, { token, body, expectStatus } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { __raw: text }; }
  return { status: res.status, json, headers: res.headers };
}

async function test(name, fn) {
  try {
    await fn();
  } catch (err) {
    record(name, false, `exception: ${err.message}`);
  }
}

function expect(cond, failDetail) {
  if (!cond) throw new Error(failDetail);
}

// ---------- run ----------
let token = null;
const MARK = `APITEST-${Date.now()}`;
const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

// ===== Auth =====
await test('auth: admin login succeeds', async () => {
  const r = await req('POST', '/auth/admin/login', { body: { email: EMAIL, password: PASSWORD } });
  expect(r.status === 200 && r.json?.token, `status=${r.status} body=${JSON.stringify(r.json)}`);
  token = r.json.token;
  record('auth: admin login succeeds', true);
});

if (!token) {
  console.log('No token — aborting remaining tests');
  process.exit(1);
}

await test('auth: wrong password rejected', async () => {
  const r = await req('POST', '/auth/admin/login', { body: { email: EMAIL, password: 'WrongPass999!' } });
  expect(r.status === 401 || r.status === 400, `status=${r.status}`);
  record('auth: wrong password rejected', true, `status=${r.status}`);
});

await test('auth: no token -> 401', async () => {
  const r = await req('GET', '/admin/vendors');
  expect(r.status === 401, `status=${r.status}`);
  record('auth: no token -> 401', true);
});

await test('auth: garbage token -> 401', async () => {
  const r = await req('GET', '/admin/vendors', { token: 'garbage.token.value' });
  expect(r.status === 401, `status=${r.status}`);
  record('auth: garbage token -> 401', true);
});

// ===== Overview / Analytics =====
await test('analytics: default', async () => {
  const r = await req('GET', '/admin/analytics', { token });
  expect(r.status === 200 && r.json && typeof r.json === 'object', `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  record('analytics: default', true);
});

await test('analytics: with from/to/city params', async () => {
  const r = await req('GET', '/admin/analytics?from=2025-01-01&to=2026-12-31&city=Phoenix', { token });
  expect(r.status === 200, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  record('analytics: with from/to/city params', true);
});

// ===== Vendors =====
let vendorId = null;
await test('vendors: list', async () => {
  const r = await req('GET', '/admin/vendors', { token });
  expect(r.status === 200 && Array.isArray(r.json), `status=${r.status}`);
  record('vendors: list', true, `count=${r.json.length}`);
});

await test('vendors: list with filters', async () => {
  const r = await req('GET', '/admin/vendors?status=approved&city=Phoenix&category=Food', { token });
  expect(r.status === 200 && Array.isArray(r.json), `status=${r.status}`);
  record('vendors: list with filters', true);
});

await test('vendors: create (no email)', async () => {
  const r = await req('POST', '/admin/vendors', {
    token,
    body: { name: `${MARK} Vendor`, city: 'Phoenix', category: 'Test', discountType: 'percent', discountValue: 15, address: '123 Test St, Phoenix, AZ' },
  });
  expect(r.status === 201 && r.json?.vendor?.id, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 300)}`);
  vendorId = r.json.vendor.id;
  created.vendors.push(vendorId);
  expect(r.json.discountCode, 'no discountCode in response');
  record('vendors: create (no email)', true);
});

await test('vendors: create validation error (missing name)', async () => {
  const r = await req('POST', '/admin/vendors', { token, body: { city: 'Phoenix' } });
  expect(r.status === 400, `status=${r.status}`);
  record('vendors: create validation error (missing name)', true);
});

await test('vendors: create BOGO without description -> 400', async () => {
  const r = await req('POST', '/admin/vendors', { token, body: { name: `${MARK} Bogo`, discountType: 'bogo' } });
  expect(r.status === 400, `status=${r.status} body=${JSON.stringify(r.json)}`);
  record('vendors: create BOGO without description -> 400', true);
});

await test('vendors: get by id', async () => {
  const r = await req('GET', `/admin/vendors/${vendorId}`, { token });
  expect(r.status === 200 && r.json?.id === vendorId, `status=${r.status}`);
  expect(r.json.discount_type === 'percent' && Number(r.json.discount_value) === 15, `discount fields wrong: type=${r.json.discount_type} value=${r.json.discount_value}`);
  record('vendors: get by id', true);
});

await test('vendors: get missing -> 404', async () => {
  const r = await req('GET', `/admin/vendors/${FAKE_UUID}`, { token });
  expect(r.status === 404, `status=${r.status}`);
  record('vendors: get missing -> 404', true);
});

await test('vendors: patch', async () => {
  const r = await req('PATCH', `/admin/vendors/${vendorId}`, {
    token,
    body: { city: 'Tempe', discountValue: 20, discountDescription: 'APITEST desc', boosted: true },
  });
  expect(r.status === 200 && r.json?.city === 'Tempe', `status=${r.status} body=${JSON.stringify(r.json).slice(0, 300)}`);
  record('vendors: patch', true);
});

await test('vendors: patch persists discount fields', async () => {
  const r = await req('GET', `/admin/vendors/${vendorId}`, { token });
  expect(r.status === 200, `status=${r.status}`);
  expect(Number(r.json.discount_value) === 20, `discount_value=${r.json.discount_value}`);
  expect(r.json.discount_description === 'APITEST desc', `discount_description=${r.json.discount_description}`);
  expect(r.json.discount_boosted === true, `discount_boosted=${r.json.discount_boosted}`);
  record('vendors: patch persists discount fields', true);
});

await test('vendors: approve', async () => {
  const r = await req('POST', `/admin/vendors/${vendorId}/approve`, { token });
  expect(r.status === 200, `status=${r.status}`);
  record('vendors: approve', true);
});

await test('vendors: reject then re-approve', async () => {
  const r1 = await req('POST', `/admin/vendors/${vendorId}/reject`, { token });
  expect(r1.status === 200, `reject status=${r1.status}`);
  const r2 = await req('POST', `/admin/vendors/${vendorId}/approve`, { token });
  expect(r2.status === 200, `approve status=${r2.status}`);
  record('vendors: reject then re-approve', true);
});

await test('vendors: pass', async () => {
  const r = await req('GET', `/admin/vendors/${vendorId}/pass`, { token });
  expect(r.status === 200 && r.json?.discountCode, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  record('vendors: pass', true);
});

await test('vendors: qr regen', async () => {
  const r = await req('POST', `/admin/vendors/${vendorId}/qr`, { token });
  expect(r.status === 200 && r.json?.discountCode && r.json?.qrUrl, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  record('vendors: qr regen', true);
});

await test('vendors: reset-password', async () => {
  const r = await req('POST', `/admin/vendors/${vendorId}/reset-password`, { token });
  expect(r.status === 200 && r.json?.tempPassword, `status=${r.status}`);
  record('vendors: reset-password', true);
});

await test('vendors: activity', async () => {
  const r = await req('GET', `/admin/vendors/${vendorId}/activity`, { token });
  expect(r.status === 200 && Array.isArray(r.json), `status=${r.status}`);
  record('vendors: activity', true);
});

await test('vendors: analytics', async () => {
  const r = await req('GET', `/admin/vendors/${vendorId}/analytics`, { token });
  expect(r.status === 200, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  record('vendors: analytics', true);
});

await test('vendors: analytics missing -> 404', async () => {
  const r = await req('GET', `/admin/vendors/${FAKE_UUID}/analytics`, { token });
  expect(r.status === 404, `status=${r.status}`);
  record('vendors: analytics missing -> 404', true);
});

// ===== Stops =====
let stopId = null;
await test('stops: list (admin)', async () => {
  const r = await req('GET', '/admin/stops', { token });
  expect(r.status === 200 && Array.isArray(r.json), `status=${r.status}`);
  record('stops: list (admin)', true, `count=${r.json.length}`);
});

await test('stops: create', async () => {
  const r = await req('POST', '/admin/stops', {
    token,
    body: { name: `${MARK} Stop`, city: 'Phoenix', line: 'A', position: 9999, latitude: 33.45, longitude: -112.07 },
  });
  expect(r.status === 201 && r.json?.id, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  stopId = r.json.id;
  created.stops.push(stopId);
  record('stops: create', true);
});

await test('stops: get', async () => {
  const r = await req('GET', `/admin/stops/${stopId}`, { token });
  expect(r.status === 200 && r.json?.id === stopId, `status=${r.status}`);
  record('stops: get', true);
});

await test('stops: patch', async () => {
  const r = await req('PATCH', `/admin/stops/${stopId}`, { token, body: { city: 'Tempe', position: 9998 } });
  expect(r.status === 200 && r.json?.city === 'Tempe' && r.json?.position === 9998, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  record('stops: patch', true);
});

await test('stops: patch missing -> 404', async () => {
  const r = await req('PATCH', `/admin/stops/${FAKE_UUID}`, { token, body: { city: 'X' } });
  expect(r.status === 404, `status=${r.status}`);
  record('stops: patch missing -> 404', true);
});

await test('stops: public list contains new stop', async () => {
  const r = await req('GET', '/stops');
  expect(r.status === 200 && Array.isArray(r.json) && r.json.some((s) => s.id === stopId), `status=${r.status}`);
  record('stops: public list contains new stop', true);
});

// ===== Cards =====
let cardId = null;
await test('cards: list', async () => {
  const r = await req('GET', '/admin/cards', { token });
  expect(r.status === 200 && Array.isArray(r.json), `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  record('cards: list', true, `count=${r.json.length}`);
});

await test('cards: create', async () => {
  const r = await req('POST', '/admin/cards', {
    token,
    body: { name: `${MARK} Card`, theme: 'shops_restaurants', status: 'draft', description: 'test card' },
  });
  expect(r.status === 201 && r.json?.id, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  cardId = r.json.id;
  created.cards.push(cardId);
  record('cards: create', true);
});

await test('cards: patch', async () => {
  const r = await req('PATCH', `/admin/cards/${cardId}`, { token, body: { status: 'active', primaryColor: '#ff0000' } });
  expect(r.status === 200 && r.json?.status === 'active', `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  record('cards: patch', true);
});

await test('cards: link vendor', async () => {
  const r = await req('POST', `/admin/cards/${cardId}/vendors`, { token, body: { vendorId } });
  expect(r.status === 200, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  record('cards: link vendor', true);
});

// ===== Discounts =====
let discountId = null;
await test('discounts: create', async () => {
  const r = await req('POST', '/admin/discounts', {
    token,
    body: { cardId, vendorId, type: 'percent', value: 25, minPurchase: 5 },
  });
  expect(r.status === 201 && r.json?.id, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  discountId = r.json.id;
  created.discounts.push({ id: discountId, cardId });
  record('discounts: create', true);
});

await test('discounts: duplicate -> 409', async () => {
  const r = await req('POST', '/admin/discounts', {
    token,
    body: { cardId, vendorId, type: 'fixed', value: 5 },
  });
  expect(r.status === 409, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  record('discounts: duplicate -> 409', true);
});

await test('discounts: patch', async () => {
  const r = await req('PATCH', `/admin/discounts/${discountId}`, { token, body: { value: 30, active: false } });
  expect(r.status === 200 && Number(r.json?.value) === 30, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 300)}`);
  record('discounts: patch', true);
});

await test('discounts: patch missing -> 404', async () => {
  const r = await req('PATCH', `/admin/discounts/${FAKE_UUID}`, { token, body: { value: 1 } });
  expect(r.status === 404, `status=${r.status}`);
  record('discounts: patch missing -> 404', true);
});

await test('cards: unlink vendor', async () => {
  const r = await req('DELETE', `/admin/cards/${cardId}/vendors/${vendorId}`, { token });
  expect(r.status === 200, `status=${r.status}`);
  record('cards: unlink vendor', true);
});

// ===== Users =====
let userId = null;
await test('users: register test user (public)', async () => {
  const r = await req('POST', '/auth/register', {
    body: {
      firstName: 'APITEST', lastName: 'User', email: `${MARK.toLowerCase()}@example.com`,
      password: 'TestPass123!', termsAccepted: true, privacyAccepted: true, eulaAccepted: true,
    },
  });
  expect(r.status === 201 && r.json?.token, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  userId = r.json.profile?.id ?? r.json.profile?.userId ?? null;
  if (!userId) {
    const list = await req('GET', `/admin/users?search=${MARK.toLowerCase()}@example.com`, { token });
    userId = list.json?.[0]?.id;
  }
  created.users.push(userId);
  record('users: register test user (public)', true, `id=${userId}`);
});

await test('users: list', async () => {
  const r = await req('GET', '/admin/users', { token });
  expect(r.status === 200 && Array.isArray(r.json), `status=${r.status}`);
  record('users: list', true, `count=${r.json.length}`);
});

await test('users: list search', async () => {
  const r = await req('GET', `/admin/users?search=${encodeURIComponent(MARK.toLowerCase())}`, { token });
  expect(r.status === 200 && r.json.length === 1, `status=${r.status} count=${r.json?.length}`);
  record('users: list search', true);
});

await test('users: get', async () => {
  const r = await req('GET', `/admin/users/${userId}`, { token });
  expect(r.status === 200 && r.json?.id === userId, `status=${r.status}`);
  record('users: get', true);
});

await test('users: patch', async () => {
  const r = await req('PATCH', `/admin/users/${userId}`, {
    token,
    body: { fullName: 'APITEST Renamed', city: 'Mesa', pushPreferences: { newVendor: false }, promoEmailOptIn: true },
  });
  expect(r.status === 200, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 300)}`);
  record('users: patch', true);
});

await test('users: patch missing -> 404', async () => {
  const r = await req('PATCH', `/admin/users/${FAKE_UUID}`, { token, body: { city: 'X' } });
  expect(r.status === 404, `status=${r.status}`);
  record('users: patch missing -> 404', true);
});

// ===== Content =====
let contentId = null;
await test('content: list', async () => {
  const r = await req('GET', '/admin/content', { token });
  expect(r.status === 200 && Array.isArray(r.json), `status=${r.status}`);
  record('content: list', true, `count=${r.json.length}`);
});

await test('content: create', async () => {
  const r = await req('POST', '/admin/content', {
    token,
    body: { kind: 'text', title: `${MARK} Block`, body: 'test body', position: 9999, published: false },
  });
  expect(r.status === 201 && r.json?.id, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  contentId = r.json.id;
  created.content.push(contentId);
  record('content: create', true);
});

await test('content: patch', async () => {
  const r = await req('PATCH', `/admin/content/${contentId}`, { token, body: { title: `${MARK} Edited`, published: true } });
  expect(r.status === 200 && r.json?.title === `${MARK} Edited`, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  record('content: patch', true);
});

await test('content: status', async () => {
  const r = await req('GET', '/admin/content/status', { token });
  expect(r.status === 200 && typeof r.json?.currentVersion === 'number', `status=${r.status} body=${JSON.stringify(r.json)}`);
  record('content: status', true, JSON.stringify(r.json));
});

await test('content: publish', async () => {
  const r = await req('POST', '/admin/content/publish', { token });
  expect((r.status === 200 || r.status === 201) && typeof r.json?.version === 'number', `status=${r.status} body=${JSON.stringify(r.json)}`);
  record('content: publish', true, `version=${r.json?.version}`);
});

await test('content: public /content reflects snapshot', async () => {
  const r = await req('GET', '/content');
  expect(r.status === 200 && Array.isArray(r.json), `status=${r.status}`);
  expect(r.headers.get('x-content-version') !== null, 'missing X-Content-Version header');
  record('content: public /content reflects snapshot', true, `version=${r.headers.get('x-content-version')}`);
});

await test('content: version endpoint', async () => {
  const r = await req('GET', '/content/version');
  expect(r.status === 200 && typeof r.json?.version === 'number', `status=${r.status} body=${JSON.stringify(r.json)}`);
  record('content: version endpoint', true);
});

await test('content: patch missing -> 404', async () => {
  const r = await req('PATCH', `/admin/content/${FAKE_UUID}`, { token, body: { title: 'x' } });
  expect(r.status === 404, `status=${r.status}`);
  record('content: patch missing -> 404', true);
});

// ===== Marketing / Push =====
await test('marketing: blast validation error', async () => {
  const r = await req('POST', '/admin/marketing/blast', { token, body: { subject: '' } });
  expect(r.status === 400, `status=${r.status}`);
  record('marketing: blast validation error', true);
});

await test('marketing: blast reach (no opted-in recipients expected to send)', async () => {
  // Only fires the real send path; if recipients exist this would email them,
  // so check first via a recipients-safe probe: send blast only if zero opt-ins.
  const users = await req('GET', '/admin/users', { token });
  const opted = (users.json ?? []).filter((u) => u.promoEmailOptIn || u.promoSmsOptIn);
  if (opted.length === 0) {
    const r = await req('POST', '/admin/marketing/blast', { token, body: { subject: 'APITEST', text: 'probe' } });
    expect(r.status === 200, `status=${r.status} body=${JSON.stringify(r.json)}`);
    record('marketing: blast reach (no opted-in recipients expected to send)', true, JSON.stringify(r.json));
  } else {
    record('marketing: blast reach (no opted-in recipients expected to send)', true, `skipped real send — ${opted.length} opted-in recipients exist`);
  }
});

await test('push: broadcast to empty city -> sent 0', async () => {
  const r = await req('POST', '/admin/push', { token, body: { title: 'APITEST', message: 'probe', city: `${MARK}-nowhere` } });
  expect(r.status === 200 && r.json?.sent === 0, `status=${r.status} body=${JSON.stringify(r.json)}`);
  record('push: broadcast to empty city -> sent 0', true);
});

await test('push: validation error (missing message)', async () => {
  const r = await req('POST', '/admin/push', { token, body: { title: 'x' } });
  expect(r.status === 400, `status=${r.status}`);
  record('push: validation error (missing message)', true);
});

// ===== Theme =====
await test('theme: get current (save for restore)', async () => {
  const r = await req('GET', '/admin/settings/theme', { token });
  expect(r.status === 200, `status=${r.status}`);
  restored.theme = r.json;
  expect(r.json?.brand && Array.isArray(r.json?.tabs), 'theme shape unexpected');
  record('theme: get current (save for restore)', true);
});

await test('theme: patch + verify + restore', async () => {
  const modified = { ...restored.theme, brand: '#123456' };
  const r = await req('PATCH', '/admin/settings/theme', { token, body: modified });
  expect(r.status === 200, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  const check = await req('GET', '/settings/theme');
  expect(check.json?.brand === '#123456', `public theme not updated: ${check.json?.brand}`);
  const back = await req('PATCH', '/admin/settings/theme', { token, body: restored.theme });
  expect(back.status === 200, `restore status=${back.status}`);
  record('theme: patch + verify + restore', true);
});

await test('theme: invalid payload -> 400', async () => {
  const r = await req('PATCH', '/admin/settings/theme', { token, body: { brand: 5 } });
  expect(r.status === 400, `status=${r.status}`);
  record('theme: invalid payload -> 400', true);
});

// ===== Events =====
let eventId = null;
await test('events: admin list (save urls)', async () => {
  const r = await req('GET', '/admin/events', { token });
  expect(r.status === 200 && Array.isArray(r.json?.urls) && Array.isArray(r.json?.events), `status=${r.status}`);
  restored.rssUrls = r.json.urls;
  record('events: admin list (save urls)', true, `urls=${r.json.urls.length} events=${r.json.events.length}`);
});

await test('events: custom create', async () => {
  const r = await req('POST', '/admin/events/custom', {
    token,
    body: { title: `${MARK} Event`, eventDate: '2027-01-15', eventTime: '19:30', city: 'Phoenix', eventType: 'test' },
  });
  expect(r.status === 201 && r.json?.id, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  eventId = r.json.id;
  created.events.push(eventId);
  record('events: custom create', true);
});

await test('events: custom patch', async () => {
  const r = await req('PATCH', `/admin/events/custom/${eventId}`, { token, body: { city: 'Tempe', description: 'updated' } });
  expect(r.status === 200 && r.json?.city === 'Tempe', `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  record('events: custom patch', true);
});

await test('events: custom patch missing -> 404', async () => {
  const r = await req('PATCH', `/admin/events/custom/${FAKE_UUID}`, { token, body: { city: 'X' } });
  expect(r.status === 404, `status=${r.status}`);
  record('events: custom patch missing -> 404', true);
});

await test('events: appears in admin + public lists', async () => {
  const admin = await req('GET', '/admin/events', { token });
  expect(admin.json.events.some((e) => e.id === eventId), 'not in admin list');
  const pub = await req('GET', '/events');
  expect(pub.status === 200 && pub.json.some((e) => e.id === `custom::${eventId}`), 'not in public list');
  record('events: appears in admin + public lists', true);
});

await test('events: patch rss urls + restore', async () => {
  const r = await req('PATCH', '/admin/events', { token, body: { urls: [`https://example.com/apitest.rss`] } });
  expect(r.status === 200 && Array.isArray(r.json?.urls), `status=${r.status}`);
  const back = await req('PATCH', '/admin/events', { token, body: { urls: restored.rssUrls } });
  expect(back.status === 200, `restore status=${back.status}`);
  const verify = await req('GET', '/admin/events', { token });
  expect(JSON.stringify(verify.json.urls) === JSON.stringify(restored.rssUrls), 'urls not restored');
  record('events: patch rss urls + restore', true);
});

await test('events: past event hidden from admin list', async () => {
  const r = await req('POST', '/admin/events/custom', {
    token,
    body: { title: `${MARK} Past`, eventDate: '2020-01-01' },
  });
  expect(r.status === 201, `create status=${r.status}`);
  const pastId = r.json.id;
  created.events.push(pastId);
  const list = await req('GET', '/admin/events', { token });
  expect(!list.json.events.some((e) => e.id === pastId), 'past event still listed');
  record('events: past event hidden from admin list', true);
});

// ===== Apartments =====
let aptId = null;
await test('apartments: admin list', async () => {
  const r = await req('GET', '/admin/apartments', { token });
  expect(r.status === 200 && Array.isArray(r.json), `status=${r.status}`);
  record('apartments: admin list', true, `count=${r.json.length}`);
});

await test('apartments: create', async () => {
  const r = await req('POST', '/admin/apartments', {
    token,
    body: { name: `${MARK} Apts`, listing_type: 'apartment', city: 'Phoenix', state: 'AZ', latitude: 33.45, longitude: -112.07 },
  });
  expect(r.status === 201 && r.json?.id, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 300)}`);
  aptId = r.json.id;
  created.apartments.push(aptId);
  record('apartments: create', true, `near_rail=${r.json.near_rail} station=${r.json.station}`);
});

await test('apartments: get', async () => {
  const r = await req('GET', `/admin/apartments/${aptId}`, { token });
  expect(r.status === 200 && r.json?.id === aptId, `status=${r.status}`);
  record('apartments: get', true);
});

await test('apartments: patch', async () => {
  const r = await req('PATCH', `/admin/apartments/${aptId}`, { token, body: { listing_type: 'hotel', section: 'Downtown' } });
  expect(r.status === 200 && r.json?.listing_type === 'hotel', `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  record('apartments: patch', true);
});

await test('apartments: invalid enum -> 400', async () => {
  const r = await req('POST', '/admin/apartments', { token, body: { name: 'x', listing_type: 'castle' } });
  expect(r.status === 400, `status=${r.status}`);
  record('apartments: invalid enum -> 400', true);
});

await test('apartments: public list (near_rail only)', async () => {
  const r = await req('GET', '/apartments');
  expect(r.status === 200 && Array.isArray(r.json), `status=${r.status}`);
  expect(r.json.every((a) => a.near_rail === true), 'public list includes non-near_rail rows');
  record('apartments: public list (near_rail only)', true);
});

// ===== Real Estate =====
let reId = null;
await test('real-estate: admin list', async () => {
  const r = await req('GET', '/admin/real-estate', { token });
  expect(r.status === 200 && Array.isArray(r.json), `status=${r.status}`);
  record('real-estate: admin list', true, `count=${r.json.length}`);
});

await test('real-estate: create', async () => {
  const r = await req('POST', '/admin/real-estate', {
    token,
    body: { title: `${MARK} Condo`, price: 350000, beds: 2, baths: 2, sqft: 1100, property_type: 'condo', city: 'Phoenix', state: 'AZ', active: true },
  });
  expect(r.status === 201 && r.json?.id, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 300)}`);
  reId = r.json.id;
  created.realEstate.push(reId);
  expect(r.json.listing_status === 'for_sale', `default listing_status=${r.json.listing_status}`);
  record('real-estate: create', true);
});

await test('real-estate: get', async () => {
  const r = await req('GET', `/admin/real-estate/${reId}`, { token });
  expect(r.status === 200 && r.json?.id === reId, `status=${r.status}`);
  record('real-estate: get', true);
});

await test('real-estate: patch', async () => {
  const r = await req('PATCH', `/admin/real-estate/${reId}`, { token, body: { price: 340000, listing_status: 'pending', active: false } });
  expect(r.status === 200 && Number(r.json?.price) === 340000 && r.json?.active === false, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  record('real-estate: patch', true);
});

await test('real-estate: inactive hidden from public', async () => {
  const r = await req('GET', '/real-estate');
  expect(r.status === 200 && Array.isArray(r.json), `status=${r.status}`);
  expect(!r.json.some((l) => l.id === reId), 'inactive listing visible publicly');
  record('real-estate: inactive hidden from public', true);
});

await test('real-estate: get missing -> 404', async () => {
  const r = await req('GET', `/admin/real-estate/${FAKE_UUID}`, { token });
  expect(r.status === 404, `status=${r.status}`);
  record('real-estate: get missing -> 404', true);
});

// ===== Ads =====
let adId = null;
await test('ads: admin list', async () => {
  const r = await req('GET', '/admin/ads', { token });
  expect(r.status === 200 && Array.isArray(r.json), `status=${r.status}`);
  record('ads: admin list', true, `count=${r.json.length}`);
});

await test('ads: upsert slot 5', async () => {
  const r = await req('POST', '/admin/ads', {
    token,
    body: { slot: 5, image_url: 'https://example.com/apitest.png', link_url: 'https://example.com', active: true },
  });
  expect(r.status === 201 && r.json?.id, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  adId = r.json.id;
  if (!created.ads.includes(adId)) created.ads.push(adId);
  record('ads: upsert slot 5', true);
});

await test('ads: patch', async () => {
  const r = await req('PATCH', `/admin/ads/${adId}`, { token, body: { link_url: 'https://example.com/updated', active: false } });
  expect(r.status === 200 && r.json?.active === false, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);
  record('ads: patch', true);
});

await test('ads: invalid slot -> 400', async () => {
  const r = await req('POST', '/admin/ads', { token, body: { slot: 9, image_url: 'x' } });
  expect(r.status === 400, `status=${r.status}`);
  record('ads: invalid slot -> 400', true);
});

await test('ads: public list hides inactive', async () => {
  const r = await req('GET', '/ads');
  expect(r.status === 200 && Array.isArray(r.json), `status=${r.status}`);
  expect(!r.json.some((a) => a.id === adId), 'inactive ad visible publicly');
  record('ads: public list hides inactive', true);
});

// ===== App publish =====
await test('app: status', async () => {
  const r = await req('GET', '/admin/app/status', { token });
  expect(r.status === 200, `status=${r.status} body=${JSON.stringify(r.json).slice(0, 300)}`);
  record('app: status', true, JSON.stringify(r.json).slice(0, 120));
});

await test('app: publish', async () => {
  const r = await req('POST', '/admin/app/publish', { token });
  expect((r.status === 200 || r.status === 201) && typeof r.json?.version === 'number', `status=${r.status} body=${JSON.stringify(r.json).slice(0, 300)}`);
  record('app: publish', true, `version=${r.json?.version}`);
});

await test('app: public /app snapshot', async () => {
  const r = await req('GET', '/app');
  expect(r.status === 200 && r.json && Array.isArray(r.json.vendors) && Array.isArray(r.json.stops), `status=${r.status} keys=${r.json ? Object.keys(r.json) : 'none'}`);
  record('app: public /app snapshot', true);
});

await test('app: public /app/version', async () => {
  const r = await req('GET', '/app/version');
  expect(r.status === 200 && r.json && typeof r.json.version === 'number', `status=${r.status} body=${JSON.stringify(r.json)}`);
  record('app: public /app/version', true);
});

// ===== Settings / Profile =====
await test('settings: get admin settings', async () => {
  const r = await req('GET', '/admin/settings', { token });
  expect(r.status === 200 && r.json?.email, `status=${r.status} body=${JSON.stringify(r.json)}`);
  restored.adminLocation = r.json.location ?? null;
  record('settings: get admin settings', true);
});

await test('settings: get profile', async () => {
  const r = await req('GET', '/admin/profile', { token });
  expect(r.status === 200 && r.json?.email, `status=${r.status}`);
  record('settings: get profile', true);
});

await test('settings: patch location + restore', async () => {
  const r = await req('PATCH', '/admin/settings', { token, body: { location: 'APITESTville' } });
  expect(r.status === 200 && r.json?.location === 'APITESTville', `status=${r.status} body=${JSON.stringify(r.json)}`);
  const back = await req('PATCH', '/admin/settings', { token, body: { location: restored.adminLocation ?? '' } });
  expect(back.status === 200, `restore status=${back.status} body=${JSON.stringify(back.json)}`);
  record('settings: patch location + restore', true);
});

await test('settings: patch empty body -> 400', async () => {
  const r = await req('PATCH', '/admin/settings', { token, body: {} });
  expect(r.status === 400, `status=${r.status}`);
  record('settings: patch empty body -> 400', true);
});

// ===== Cleanup =====
console.log('\n--- cleanup ---');
async function del(path) {
  const r = await req('DELETE', path, { token });
  console.log(`DELETE ${path} -> ${r.status}`);
  return r.status;
}
await del(`/admin/discounts/${discountId}`);
for (const id of created.cards) await del(`/admin/cards/${id}`);
for (const id of created.users) if (id) await del(`/admin/users/${id}`);
for (const id of created.stops) await del(`/admin/stops/${id}`);
for (const id of created.apartments) await del(`/admin/apartments/${id}`);
for (const id of created.realEstate) await del(`/admin/real-estate/${id}`);
for (const id of created.ads) await del(`/admin/ads/${id}`);
for (const id of created.content) await del(`/admin/content/${id}`);
for (const id of created.events) await del(`/admin/events/custom/${id}`);
if (created.vendors.length) {
  console.log(`NOTE: vendor ${created.vendors.join(',')} has no admin delete endpoint; left as "${MARK} Vendor" (rejected status recommended)`);
  await req('POST', `/admin/vendors/${created.vendors[0]}/reject`, { token });
}

// ===== Summary =====
const failed = results.filter((r) => !r.pass);
console.log(`\n===== SUMMARY: ${results.length - failed.length}/${results.length} passed =====`);
for (const f of failed) console.log(`FAIL: ${f.name} — ${f.detail}`);
process.exit(failed.length ? 2 : 0);
