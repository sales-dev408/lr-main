import { posthog } from './posthog';

type LogAttributes = Record<string, string | number | boolean>;

export const posthogLog = {
  info(body: string, attributes: LogAttributes) {
    posthog?.logger.info(body, attributes);
  },
};
