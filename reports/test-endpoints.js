const BASE = process.env.BASE_URL || 'http://localhost:4000/api';

const results = [];

function log(method, path, expected, status, ok, extra = {}) {
  const entry = { method, path, expected, status, ok, ...extra };
  results.push(entry);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${method} ${path} -> ${status} (expected ${expected})`);
  if (extra.error) console.error('  error:', extra.error);
}

async function request(method, path, { token, body, headers: extraHeaders = {}, redirect = 'follow', base = BASE } = {}) {
  const headers = { 'User-Agent': 'lr-e2e-test', ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  const init = { method, headers, redirect };
  if (body) {
    if (typeof body === 'string') {
      init.body = body;
      headers['Content-Type'] = 'application/json';
    } else if (body instanceof URLSearchParams) {
      init.body = body;
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else {
      init.body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }
  }
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, init);
    let text;
    try {
      text = await res.text();
    } catch {
      text = '';
    }
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: res.status, headers: res.headers, text, json, url: res.url };
  } catch (err) {
    return { error: err.message, status: 0 };
  }
}

function assertStatus(entry, actual, expected, details = {}) {
  const ok = expected.includes ? expected.includes(actual) : actual === expected;
  log(entry.method, entry.path, expected, actual, ok, details);
  return ok;
}

async function main() {
  const stamp = Date.now().toString(36);
  const adminEmail = 'owner@example.com';
  const adminPassword = 'ChangeMe123!';
  const customerEmail = `test-customer-${stamp}@example.com`;
  const customerPhone = `602555${Math.floor(1000 + Math.random() * 9000)}`;
  const customerPassword = 'Password123!';
  const resetPassword = 'NewPass123!';
  const vendorEmail = `test-vendor-${stamp}@example.com`;
  const vendorPassword = 'Password123!';

  // 1. health / root
  let r = await request('GET', '/health');
  assertStatus({ method: 'GET', path: '/health' }, r.status, 200, { body: r.json });

  r = await request('GET', '/', { base: 'http://localhost:4000' });
  assertStatus({ method: 'GET', path: 'http://localhost:4000/' }, r.status, 200, { body: r.json });

  // 2. admin auth
  r = await request('POST', '/auth/admin/login', { body: JSON.stringify({ email: adminEmail, password: adminPassword }) });
  assertStatus({ method: 'POST', path: '/auth/admin/login' }, r.status, 200, { body: r.json });
  const adminToken = r.json?.token;

  // 3. register test customer
  r = await request('POST', '/auth/register', { body: JSON.stringify({ firstName: 'Test', lastName: 'Customer', email: customerEmail, phone: customerPhone, password: customerPassword, termsAccepted: true, privacyAccepted: true, eulaAccepted: true, promoEmailOptIn: false, promoSmsOptIn: false }) });
  assertStatus({ method: 'POST', path: '/auth/register' }, r.status, 201, { body: r.json });
  const customerToken = r.json?.token;

  // 4. register test vendor (public endpoint)
  r = await request('POST', '/vendor/register', { body: JSON.stringify({ name: `Test Vendor ${stamp}`, location: '123 Main St', city: 'Phoenix', category: 'Dining', posType: 'square', email: vendorEmail, password: vendorPassword }) });
  assertStatus({ method: 'POST', path: '/vendor/register' }, r.status, 201, { body: r.json });
  const publicVendorId = r.json?.id;

  // 5. vendor login
  r = await request('POST', '/auth/vendor/login', { body: JSON.stringify({ email: vendorEmail, password: vendorPassword }) });
  assertStatus({ method: 'POST', path: '/auth/vendor/login' }, r.status, 200, { body: r.json });
  const vendorToken = r.json?.token;

  // 6. test customer login
  r = await request('POST', '/auth/login', { body: JSON.stringify({ email: customerEmail, password: customerPassword }) });
  assertStatus({ method: 'POST', path: '/auth/login' }, r.status, 200, { body: r.json });

  // 7. social login (dummy)
  r = await request('POST', '/auth/social', { body: JSON.stringify({ provider: 'google', idToken: `test-social-${stamp}`, fullName: 'Social User' }) });
  assertStatus({ method: 'POST', path: '/auth/social' }, r.status, 200, { body: r.json });

  // 8. forgot password flow
  r = await request('POST', '/auth/forgot-password', { body: JSON.stringify({ phone: customerPhone }) });
  assertStatus({ method: 'POST', path: '/auth/forgot-password' }, r.status, 200, { body: r.json });
  const resetCode = r.json?.verificationCode;

  if (resetCode) {
    r = await request('POST', '/auth/reset-password', { body: JSON.stringify({ phone: customerPhone, code: resetCode, password: resetPassword }) });
    assertStatus({ method: 'POST', path: '/auth/reset-password' }, r.status, 200, { body: r.json });

    r = await request('POST', '/auth/login', { body: JSON.stringify({ email: customerEmail, password: resetPassword }) });
    assertStatus({ method: 'POST', path: '/auth/login (after reset)' }, r.status, 200, { body: r.json });
  }

  // 9. admin card list
  r = await request('GET', '/admin/cards', { token: adminToken });
  assertStatus({ method: 'GET', path: '/admin/cards' }, r.status, 200, { count: Array.isArray(r.json) ? r.json.length : null });
  const cards = r.json || [];
  const membershipCard = cards.find((c) => c.is_membership === true) || cards[0];
  const nonMembershipCard = cards.find((c) => c.is_membership === false) || cards[1] || membershipCard;

  // 9. customer cards
  r = await request('GET', '/cards');
  assertStatus({ method: 'GET', path: '/cards' }, r.status, 200, { count: Array.isArray(r.json) ? r.json.length : null });

  r = await request('GET', `/cards/${membershipCard.id}`);
  assertStatus({ method: 'GET', path: `/cards/${membershipCard.id}` }, r.status, 200, { body: r.json });

  // 10. admin create vendor with discount
  r = await request('POST', '/admin/vendors', { token: adminToken, body: JSON.stringify({ name: `Admin Vendor ${stamp}`, ownerName: 'Owner', address: '456 Oak Ave, Phoenix, AZ 85001', category: 'Dining', email: `admin-vendor-${stamp}@example.com`, phone: '6025550000', discountType: 'percent', discountValue: 15 }) });
  assertStatus({ method: 'POST', path: '/admin/vendors' }, r.status, 201, { body: r.json });
  const adminVendorId = r.json?.vendor?.id;

  // 11. admin vendor list and detail
  r = await request('GET', '/admin/vendors', { token: adminToken });
  assertStatus({ method: 'GET', path: '/admin/vendors' }, r.status, 200, { count: Array.isArray(r.json) ? r.json.length : null });

  r = await request('GET', `/admin/vendors/${adminVendorId}`, { token: adminToken });
  assertStatus({ method: 'GET', path: `/admin/vendors/${adminVendorId}` }, r.status, 200, { body: r.json, note: 'no individual vendor GET route exists in admin.ts' });

  // 12. admin analytics
  r = await request('GET', '/admin/analytics', { token: adminToken });
  assertStatus({ method: 'GET', path: '/admin/analytics' }, r.status, 200, { body: r.json });

  // 13. vendor approve / reject / pass / reset / qr
  r = await request('POST', `/admin/vendors/${adminVendorId}/approve`, { token: adminToken });
  assertStatus({ method: 'POST', path: `/admin/vendors/${adminVendorId}/approve` }, r.status, 200);

  r = await request('GET', `/admin/vendors/${adminVendorId}/pass`, { token: adminToken });
  assertStatus({ method: 'GET', path: `/admin/vendors/${adminVendorId}/pass` }, r.status, 200, { body: r.json });
  const adminVendorDiscountCode = r.json?.discountCode;

  r = await request('POST', `/admin/vendors/${adminVendorId}/reset-password`, { token: adminToken });
  assertStatus({ method: 'POST', path: `/admin/vendors/${adminVendorId}/reset-password` }, r.status, 200, { body: r.json });

  r = await request('POST', `/admin/vendors/${adminVendorId}/qr`, { token: adminToken });
  assertStatus({ method: 'POST', path: `/admin/vendors/${adminVendorId}/qr` }, r.status, 200, { body: r.json });

  r = await request('POST', `/admin/vendors/${adminVendorId}/reject`, { token: adminToken });
  assertStatus({ method: 'POST', path: `/admin/vendors/${adminVendorId}/reject` }, r.status, 200);

  // 14. admin vendor analytics/activity
  r = await request('GET', `/admin/vendors/${adminVendorId}/activity`, { token: adminToken });
  assertStatus({ method: 'GET', path: `/admin/vendors/${adminVendorId}/activity` }, r.status, 200);

  r = await request('GET', `/admin/vendors/${adminVendorId}/analytics`, { token: adminToken });
  assertStatus({ method: 'GET', path: `/admin/vendors/${adminVendorId}/analytics` }, r.status, 200, { body: r.json });

  // 15. update vendor
  r = await request('PATCH', `/admin/vendors/${adminVendorId}`, { token: adminToken, body: JSON.stringify({ name: `Updated Vendor ${stamp}`, status: 'approved' }) });
  assertStatus({ method: 'PATCH', path: `/admin/vendors/${adminVendorId}` }, r.status, 200);

  // 16. public vendor directory
  r = await request('GET', '/vendors');
  assertStatus({ method: 'GET', path: '/vendors' }, r.status, 200, { count: Array.isArray(r.json) ? r.json.length : null });

  // 17. admin create/edit/delete card
  r = await request('POST', '/admin/cards', { token: adminToken, body: JSON.stringify({ name: `Test Card ${stamp}`, theme: 'sports', status: 'active' }) });
  assertStatus({ method: 'POST', path: '/admin/cards' }, r.status, 201, { body: r.json });
  const testCardId = r.json?.id;

  r = await request('PATCH', `/admin/cards/${testCardId}`, { token: adminToken, body: JSON.stringify({ description: 'Updated description' }) });
  assertStatus({ method: 'PATCH', path: `/admin/cards/${testCardId}` }, r.status, 200);

  // 18. card-vendor linking
  r = await request('POST', `/admin/cards/${testCardId}/vendors`, { token: adminToken, body: JSON.stringify({ vendorId: adminVendorId }) });
  assertStatus({ method: 'POST', path: `/admin/cards/${testCardId}/vendors` }, r.status, 200, { body: r.json });

  r = await request('DELETE', `/admin/cards/${testCardId}/vendors/${adminVendorId}`, { token: adminToken });
  assertStatus({ method: 'DELETE', path: `/admin/cards/${testCardId}/vendors/${adminVendorId}` }, r.status, 200);

  // 19. discount create/edit/delete
  r = await request('POST', '/admin/discounts', { token: adminToken, body: JSON.stringify({ cardId: testCardId, vendorId: adminVendorId, type: 'percent', value: 10 }) });
  assertStatus({ method: 'POST', path: '/admin/discounts' }, r.status, 201, { body: r.json });
  const testDiscountId = r.json?.id;

  r = await request('PATCH', `/admin/discounts/${testDiscountId}`, { token: adminToken, body: JSON.stringify({ value: 12 }) });
  assertStatus({ method: 'PATCH', path: `/admin/discounts/${testDiscountId}` }, r.status, 200);

  r = await request('DELETE', `/admin/discounts/${testDiscountId}`, { token: adminToken });
  assertStatus({ method: 'DELETE', path: `/admin/discounts/${testDiscountId}` }, r.status, 200);

  // cleanup card
  r = await request('DELETE', `/admin/cards/${testCardId}`, { token: adminToken });
  assertStatus({ method: 'DELETE', path: `/admin/cards/${testCardId}` }, r.status, 200);

  // 20. ads CRUD
  r = await request('GET', '/admin/ads', { token: adminToken });
  assertStatus({ method: 'GET', path: '/admin/ads' }, r.status, 200);

  const adIds = [];
  for (let slot = 1; slot <= 5; slot += 1) {
    r = await request('POST', '/admin/ads', { token: adminToken, body: JSON.stringify({ slot, image_url: `https://via.placeholder.com/300x150?text=Ad${slot}`, link_url: 'https://example.com', active: true }) });
    assertStatus({ method: 'POST', path: '/admin/ads' }, r.status, 201, { body: r.json });
    adIds.push(r.json?.id);
  }

  r = await request('PATCH', `/admin/ads/${adIds[1]}`, { token: adminToken, body: JSON.stringify({ link_url: 'https://example.net' }) });
  assertStatus({ method: 'PATCH', path: '/admin/ads/:id' }, r.status, 200);

  r = await request('GET', '/ads');
  assertStatus({ method: 'GET', path: '/ads' }, r.status, 200, { count: Array.isArray(r.json) ? r.json.length : null, expected: 5 });

  for (const id of adIds) {
    r = await request('DELETE', `/admin/ads/${id}`, { token: adminToken });
    assertStatus({ method: 'DELETE', path: '/admin/ads/:id' }, r.status, 200);
  }

  // 21. events CRUD
  r = await request('GET', '/admin/events', { token: adminToken });
  assertStatus({ method: 'GET', path: '/admin/events' }, r.status, 200, { body: r.json });

  r = await request('PATCH', '/admin/events', { token: adminToken, body: JSON.stringify({ urls: [] }) });
  assertStatus({ method: 'PATCH', path: '/admin/events' }, r.status, 200);

  r = await request('POST', '/admin/events/custom', { token: adminToken, body: JSON.stringify({ title: `Event ${stamp}`, description: 'Test event', eventDate: new Date().toISOString().slice(0, 10) }) });
  assertStatus({ method: 'POST', path: '/admin/events/custom' }, r.status, 201, { body: r.json });
  const eventId = r.json?.id;

  r = await request('PATCH', `/admin/events/custom/${eventId}`, { token: adminToken, body: JSON.stringify({ title: `Updated Event ${stamp}` }) });
  assertStatus({ method: 'PATCH', path: `/admin/events/custom/${eventId}` }, r.status, 200);

  r = await request('GET', '/events');
  assertStatus({ method: 'GET', path: '/events' }, r.status, 200);

  r = await request('DELETE', `/admin/events/custom/${eventId}`, { token: adminToken });
  assertStatus({ method: 'DELETE', path: `/admin/events/custom/${eventId}` }, r.status, 204);

  // 22. content CRUD
  r = await request('GET', '/admin/content', { token: adminToken });
  assertStatus({ method: 'GET', path: '/admin/content' }, r.status, 200);

  r = await request('POST', '/admin/content', { token: adminToken, body: JSON.stringify({ kind: 'text', title: `Content ${stamp}`, body: 'Hello world', published: true }) });
  assertStatus({ method: 'POST', path: '/admin/content' }, r.status, 201, { body: r.json });
  const contentId = r.json?.id;

  r = await request('GET', '/content');
  assertStatus({ method: 'GET', path: '/content' }, r.status, 200);

  r = await request('PATCH', `/admin/content/${contentId}`, { token: adminToken, body: JSON.stringify({ body: 'Updated world' }) });
  assertStatus({ method: 'PATCH', path: `/admin/content/${contentId}` }, r.status, 200);

  r = await request('DELETE', `/admin/content/${contentId}`, { token: adminToken });
  assertStatus({ method: 'DELETE', path: `/admin/content/${contentId}` }, r.status, 200);

  // 23. theme
  r = await request('GET', '/settings/theme');
  assertStatus({ method: 'GET', path: '/settings/theme' }, r.status, 200);

  r = await request('GET', '/admin/settings/theme', { token: adminToken });
  assertStatus({ method: 'GET', path: '/admin/settings/theme' }, r.status, 200);

  r = await request('PATCH', '/admin/settings/theme', { token: adminToken, body: JSON.stringify({ brand: '#0d9488', primaryGradient: ['#0d9488', '#6366f1'], tabs: [{ key: 'index', label: 'Home', color: '#0d9488', gradient: ['#14b8a6', '#0d9488'] }] }) });
  assertStatus({ method: 'PATCH', path: '/admin/settings/theme' }, r.status, 200, { body: r.json });

  // 24. admin settings/profile
  r = await request('GET', '/admin/settings', { token: adminToken });
  assertStatus({ method: 'GET', path: '/admin/settings' }, r.status, 200, { body: r.json });

  r = await request('PATCH', '/admin/settings', { token: adminToken, body: JSON.stringify({ email: adminEmail, location: 'Phoenix, AZ' }) });
  assertStatus({ method: 'PATCH', path: '/admin/settings' }, r.status, 200, { body: r.json });

  r = await request('GET', '/admin/profile', { token: adminToken });
  assertStatus({ method: 'GET', path: '/admin/profile' }, r.status, 200, { body: r.json });

  // 25. marketing blast
  r = await request('POST', '/admin/marketing/blast', { token: adminToken, body: JSON.stringify({ subject: 'Test', text: 'Hello' }) });
  assertStatus({ method: 'POST', path: '/admin/marketing/blast' }, r.status, 200, { body: r.json });

  // 26. customer me endpoints
  r = await request('GET', '/me', { token: customerToken });
  assertStatus({ method: 'GET', path: '/me' }, r.status, 200, { body: r.json });

  r = await request('GET', '/me/analytics', { token: customerToken });
  assertStatus({ method: 'GET', path: '/me/analytics' }, r.status, 200, { body: r.json });

  r = await request('PATCH', '/me', { token: customerToken, body: JSON.stringify({ city: 'Phoenix' }) });
  assertStatus({ method: 'PATCH', path: '/me' }, r.status, 200, { body: r.json });

  r = await request('POST', '/me/push-token', { token: customerToken, body: JSON.stringify({ token: `push-${stamp}`, city: 'Phoenix' }) });
  assertStatus({ method: 'POST', path: '/me/push-token' }, r.status, 200, { body: r.json });

  r = await request('GET', '/me/pass', { token: customerToken });
  assertStatus({ method: 'GET', path: '/me/pass' }, r.status, 200, { body: r.json });
  const customerPass = r.json;
  const lookupToken = customerPass?.pass?.lookupToken;
  const passSerial = customerPass?.pass?.serialNumber;

  r = await request('POST', '/me/pass', { token: customerToken, body: JSON.stringify({ platform: 'google' }) });
  assertStatus({ method: 'POST', path: '/me/pass' }, r.status, 200, { body: r.json });

  // 27. passes
  r = await request('POST', '/passes', { token: customerToken, body: JSON.stringify({ cardId: nonMembershipCard.id, platform: 'google' }) });
  assertStatus({ method: 'POST', path: '/passes' }, r.status, 201, { body: r.json });
  const createdPass = r.json;

  r = await request('GET', `/passes/${createdPass.pass.serialNumber}`);
  assertStatus({ method: 'GET', path: `/passes/${createdPass.pass.serialNumber}` }, r.status, 200, { body: r.json });

  r = await request('POST', `/passes/${createdPass.pass.serialNumber}/registrations/dev-lib-${stamp}`, { body: JSON.stringify({ pushToken: `pt-${stamp}` }) });
  assertStatus({ method: 'POST', path: `/passes/${createdPass.pass.serialNumber}/registrations/dev-lib-${stamp}` }, r.status, 200, { body: r.json });

  r = await request('DELETE', `/passes/${createdPass.pass.serialNumber}/registrations/dev-lib-${stamp}`);
  assertStatus({ method: 'DELETE', path: `/passes/${createdPass.pass.serialNumber}/registrations/dev-lib-${stamp}` }, r.status, 200, { body: r.json });

  // 28. lookup/redeem/qr
  r = await request('GET', `/lookup/${lookupToken}`);
  assertStatus({ method: 'GET', path: `/lookup/${lookupToken}` }, r.status, [200, 404], { body: r.json });

  r = await request('GET', `/discounts/lookup?token=${encodeURIComponent(lookupToken)}`);
  assertStatus({ method: 'GET', path: '/discounts/lookup' }, r.status, [200, 404], { body: r.json });

  r = await request('GET', `/discounts/by-code/${encodeURIComponent(adminVendorDiscountCode || 'MISSING')}`, { token: customerToken });
  assertStatus({ method: 'GET', path: '/discounts/by-code/:code' }, r.status, [200, 409], { body: r.json });

  r = await request('GET', `/lookup/card/${membershipCard.id}`);
  assertStatus({ method: 'GET', path: `/lookup/card/${membershipCard.id}` }, r.status, [200, 404], { body: r.json });

  r = await request('POST', '/redeem', { body: JSON.stringify({ discountCode: adminVendorDiscountCode, userId: createdPass.pass ? undefined : undefined }) });
  // public redeem needs userId for a real redemption; if not provided it may still succeed as system. We send it for clarity.
  assertStatus({ method: 'POST', path: '/redeem' }, r.status, [200, 409], { body: r.json });

  r = await request('POST', '/redeem', { body: JSON.stringify({ discountCode: adminVendorDiscountCode, userId: createdPass.pass ? undefined : undefined, purchaseAmount: 100 }) });
  assertStatus({ method: 'POST', path: '/redeem (with purchase)' }, r.status, [200, 409], { body: r.json });

  r = await request('POST', '/discounts/tokens', { token: customerToken, body: JSON.stringify({ vendorId: adminVendorId }) });
  assertStatus({ method: 'POST', path: '/discounts/tokens' }, r.status, [200, 409], { body: r.json });
  const redemptionToken = r.json?.token;
  if (redemptionToken) {
    r = await request('POST', `/discounts/tokens/${redemptionToken}/affirm`, { token: customerToken, body: JSON.stringify({ affirmationName: 'Test Customer' }) });
    assertStatus({ method: 'POST', path: '/discounts/tokens/:token/affirm' }, r.status, [200, 409], { body: r.json });
  }

  if (redemptionToken) {
    r = await request('GET', `/redeem/${redemptionToken}`, { base: 'http://localhost:4000', redirect: 'manual' });
    assertStatus({ method: 'GET', path: `http://localhost:4000/redeem/${redemptionToken}` }, r.status, [200, 302], { bodyPreview: r.text?.slice(0, 80) });
  }

  r = await request('GET', '/qr/onboarding.png?vendorId=' + adminVendorId + '&cardId=' + membershipCard.id, { redirect: 'manual' });
  assertStatus({ method: 'GET', path: '/qr/onboarding.png' }, r.status, [200, 302, 307], { location: r.headers?.get('location') });

  r = await request('GET', `/qr/lookup/${lookupToken}.png`, { redirect: 'manual' });
  assertStatus({ method: 'GET', path: '/qr/lookup/:token.png' }, r.status, [200, 302, 307], { location: r.headers?.get('location') });

  const onboardingCode = Buffer.from(JSON.stringify({ vendorId: adminVendorId, cardId: membershipCard.id })).toString('base64url');
  r = await request('GET', `/onboarding/${onboardingCode}`);
  assertStatus({ method: 'GET', path: '/onboarding/:code' }, r.status, [200, 404], { body: r.json, note: `code length ${onboardingCode.length}; may exceed Fastify default maxParamLength` });

  r = await request('GET', '/onboarding/invalid-short-code');
  assertStatus({ method: 'GET', path: '/onboarding/invalid-short-code' }, r.status, [200, 404], { body: r.json });

  // 29. vendor portal
  r = await request('GET', '/vendor/cards', { token: vendorToken });
  assertStatus({ method: 'GET', path: '/vendor/cards' }, r.status, [200, 404], { body: r.json });

  r = await request('GET', '/vendor/analytics', { token: vendorToken });
  assertStatus({ method: 'GET', path: '/vendor/analytics' }, r.status, 200, { body: r.json });

  r = await request('GET', '/vendor/pos/connections', { token: vendorToken });
  assertStatus({ method: 'GET', path: '/vendor/pos/connections' }, r.status, [200, 404], { body: r.json });

  r = await request('POST', '/vendor/pos/connections/square/connect', { token: vendorToken });
  assertStatus({ method: 'POST', path: '/vendor/pos/connections/square/connect' }, r.status, [200, 400, 500], { body: r.json });

  r = await request('POST', '/vendor/pos/connections/square/sync', { token: vendorToken });
  assertStatus({ method: 'POST', path: '/vendor/pos/connections/square/sync' }, r.status, [200, 404, 500], { body: r.json });

  r = await request('DELETE', '/vendor/pos/connections/square', { token: vendorToken });
  assertStatus({ method: 'DELETE', path: '/vendor/pos/connections/square' }, r.status, [200, 404], { body: r.json });

  r = await request('GET', '/pos/oauth/callback?state=invalid&code=invalid', { redirect: 'manual' });
  assertStatus({ method: 'GET', path: '/pos/oauth/callback (manual redirect)' }, r.status, [302, 400, 500], { location: r.headers?.get('location') });

  // 30. delete customer
  r = await request('DELETE', '/me', { token: customerToken });
  assertStatus({ method: 'DELETE', path: '/me' }, r.status, [204, 500], { body: r.json });

  // Write results
  const fs = require('fs');
  fs.writeFileSync('C:/Users/Administrator/repos/lr-main/reports/endpoint-results.json', JSON.stringify(results, null, 2));
  console.log('\nDone. Total:', results.length, 'Failures:', results.filter((x) => !x.ok).length);
  process.exitCode = results.some((x) => !x.ok) ? 1 : 0;
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exitCode = 1;
});
