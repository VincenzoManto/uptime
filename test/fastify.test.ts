import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import Fastify from 'fastify';
import { errorTrackerFastify, startErrorTracker } from '../src';

let app: ReturnType<typeof Fastify>;
let server: Awaited<ReturnType<(typeof app)['listen']>>;

describe('Fastify integration', () => {
  beforeAll(async () => {
    await startErrorTracker();
    app = Fastify();
    await app.register(errorTrackerFastify);
    app.get('/err', async () => {
      throw new Error('Test error');
    });
    server = await app.listen({ port: 3050 });
  });

  /* afterAll(async () => {
    await app.close();
  }); */

  it('should serve the dashboard on /status', async () => {
    const res = await app.inject({ method: 'GET', url: '/status' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('API Status Dashboard');
  });

  it('should log errors', async () => {
    const res = await app.inject({ method: 'GET', url: '/err' });
    expect(res.statusCode).toBe(500);
    // Optionally, check if error is logged in dashboard
    const dash = await app.inject({ method: 'GET', url: '/status' });
    expect(dash.body).toContain('Test error');
  });
});
