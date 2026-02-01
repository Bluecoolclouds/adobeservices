import { z } from 'zod';
import { insertGreetingSchema, greetings } from './schema';

export const api = {
  greetings: {
    get: {
      method: 'GET' as const,
      path: '/api/greetings',
      responses: {
        200: z.array(z.custom<typeof greetings.$inferSelect>()),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
