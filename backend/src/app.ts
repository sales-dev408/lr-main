import fastify from 'fastify';
import authPlugin from './plugins/auth.js';
import securityPlugin from './plugins/security.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerUserRoutes } from './routes/user.js';
import { registerCardRoutes } from './routes/cards.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerVendorRoutes } from './routes/vendor.js';
import { registerPassRoutes } from './routes/passes.js';
import { registerLookupRoutes } from './routes/lookup.js';
import { registerRedemptionRoutes } from './routes/redemptions.js';
import { registerQrRoutes } from './routes/qr.js';
import { registerPosRoutes } from './routes/pos.js';
import { registerEventsRoutes } from './routes/events.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerApartmentsRoutes } from './routes/apartments.js';
import { registerMePassRoutes } from './routes/mePass.js';
import { registerAdsRoutes } from './routes/ads.js';

export async function buildApp() {
  const app = fastify({
    logger: true,
    bodyLimit: 1_000_000,
    routerOptions: {
      maxParamLength: 256,
    },
  });

  await app.register(securityPlugin);
  await app.register(authPlugin);

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerUserRoutes(app);
  await registerCardRoutes(app);
  await registerAdminRoutes(app);
  await registerVendorRoutes(app);
  await registerPassRoutes(app);
  await registerLookupRoutes(app);
  await registerRedemptionRoutes(app);
  await registerQrRoutes(app);
  await registerPosRoutes(app);
  await registerEventsRoutes(app);
  await registerSettingsRoutes(app);
  await registerApartmentsRoutes(app);
  await registerMePassRoutes(app);
  await registerAdsRoutes(app);

  return app;
}
