const BASE_API = 'http://localhost:4000/api';
const BASE_ROOT = 'http://localhost:4000';

const adminEmail = 'owner@example.com';
const adminPassword = 'ChangeMe123!';

const stamp = Date.now().toString(36);
const customerEmail = `test-customer-${stamp}@example.com`;
const customerPhone = `602555${Math.floor(1000 + Math.random() * 9000)}`;
const customerPassword = 'Password123!';

async function request(method, path, { token, body, base = BASE_API } = {}) {
  const headers = { 'User-Agent': 'lr-e2e-test' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

async function main() {
  // Admin login
  let r = await request('POST', '/auth/admin/login', { body: { email: adminEmail, password: adminPassword } });
  if (r.status !== 200) throw new Error(`Admin login failed: ${r.status} ${r.text}`);
  const adminToken = r.json.token;
  console.log('Admin token acquired');

  // Register customer
  r = await request('POST', '/auth/register', {
    body: {
      firstName: 'Test',
      lastName: 'Customer',
      email: customerEmail,
      phone: customerPhone,
      password: customerPassword,
      termsAccepted: true,
      privacyAccepted: true,
      eulaAccepted: true,
      promoEmailOptIn: false,
      promoSmsOptIn: false,
    },
  });
  if (r.status !== 201) throw new Error(`Customer register failed: ${r.status} ${r.text}`);
  const customerToken = r.json.token;
  console.log('Customer registered:', customerEmail, customerPhone);

  // Ensure membership pass exists
  r = await request('GET', '/me/pass', { token: customerToken });
  if (r.status !== 200) throw new Error(`Get pass failed: ${r.status} ${r.text}`);
  const pass = r.json;
  console.log('Pass:', pass.pass?.cardId || pass.pass?.passId);

  // Create an approved vendor with a discount on the membership card
  const vendorEmail = `test-vendor-${stamp}@example.com`;
  r = await request('POST', '/admin/vendors', {
    token: adminToken,
    body: {
      name: `Test Vendor ${stamp}`,
      ownerName: 'Test Owner',
      location: '123 Main St',
      city: 'Phoenix',
      category: 'Dining',
      posType: 'square',
      email: vendorEmail,
      phone: customerPhone,
      password: 'Password123!',
      discountType: 'percent',
      discountValue: 20,
      status: 'approved',
    },
  });
  if (r.status !== 201) throw new Error(`Vendor create failed: ${r.status} ${r.text}`);
  const vendorId = r.json.vendor.id;
  console.log('Vendor created:', vendorId);

  // Create a redemption token
  r = await request('POST', '/discounts/tokens', { token: customerToken, body: { vendorId } });
  if (r.status !== 200) throw new Error(`Redemption token create failed: ${r.status} ${r.text}`);
  const { token, url } = r.json;
  console.log('Redemption token:', token);
  console.log('Redeem URL:', url);

  const redeemUrl = `${BASE_ROOT}${url.startsWith('/') ? '' : '/'}${url}`;

  const fs = require('fs');
  fs.writeFileSync('C:\\tmp\\redeem-token.json', JSON.stringify({ token, url, redeemUrl, vendorId, customerEmail, customerPhone, customerPassword }, null, 2));
  console.log('Saved to C:\\tmp\\redeem-token.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
