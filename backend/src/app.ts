import fastify, { type FastifyError } from 'fastify';
import { ZodError } from 'zod';
import authPlugin from './plugins/auth.js';
import securityPlugin from './plugins/security.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerVendorRoutes } from './routes/vendor.js';
import { registerRedemptionRoutes } from './routes/redemptions.js';
import { registerEventsRoutes } from './routes/events.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerApartmentsRoutes } from './routes/apartments.js';
import { registerRealEstateRoutes } from './routes/realEstate.js';
import { registerAdsRoutes } from './routes/ads.js';
import { registerStopsRoutes } from './routes/stops.js';
import { registerAppPublishRoutes } from './routes/appPublish.js';

export async function buildApp() {
  const app = fastify({
    logger: true,
    bodyLimit: 1_000_000,
    routerOptions: {
      maxParamLength: 256,
    },
  });

  app.setErrorHandler((error: FastifyError | ZodError, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'Validation failed',
        issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  });

  await app.register(securityPlugin);
  await app.register(authPlugin);

  await registerHealthRoutes(app);
  await registerAdminRoutes(app);
  await registerVendorRoutes(app);
  await registerRedemptionRoutes(app);
  await registerEventsRoutes(app);
  await registerSettingsRoutes(app);
  await registerApartmentsRoutes(app);
  await registerRealEstateRoutes(app);
  await registerAdsRoutes(app);
  await registerStopsRoutes(app);
  await registerAppPublishRoutes(app);

  return app;
}
