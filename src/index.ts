import express, { Request, Response, NextFunction } from 'express';
import fastifyPlugin from 'fastify-plugin';
import { initDb, getDb } from './db';
import { renderDashboard } from './frontend';

import axios from 'axios';

export async function startErrorTracker() {
  console.log('Starting error tracker...');
  await initDb();
  console.log('Database initialized');
  setInterval(async () => {
    const db = getDb();
    const day = new Date().toISOString().slice(0, 10);
    await db.run(
      `
            INSERT INTO uptime(day, up_seconds, latency, endpoint_id)
            VALUES (?, 60, 0, 'system')
        `,
      day
    );
  }, 60000);

  // Ping routes every 1 minutes
}

// Express middleware
export function errorTrackerExpress(route = '/status') {
  const router = express.Router();

  const routes = router.stack;

  pingRoutes(routes.map((r: any) => ({ endpoint: r.route.path })));

  router.get(route, async (_req: Request, res: Response) => {
    const db = getDb();
    const incidents = await db.all('SELECT * FROM errors ORDER BY timestamp DESC LIMIT 10');
    const uptimeRows = await db.all('SELECT * FROM uptime ORDER BY day DESC LIMIT 2000');
    const avgUptime = uptimeRows.length ? uptimeRows.reduce((a, b) => a + b.up_seconds, 0) / uptimeRows.length : 0;
    const endpoints = router.stack
      .filter((r: any) => r.route && r.route.path && r.route.methods.get)
      .map((r: any) => r.route.path)
      .filter((path: string) => path !== route);
    res.send(renderDashboard({ incidents, uptimeRows, avgUptime, endpoints }));
  });

  return [
    async (err: any, req: Request, _res: Response, next: NextFunction) => {
      const db = getDb();
      await db.run('INSERT INTO errors (message, stack, endpoint) VALUES (?, ?, ?)', err.message, err.stack, req.originalUrl);
      next(err);
    },
    router,
  ];
}

// Fastify plugin
export const errorTrackerFastify = fastifyPlugin(async (fastify, opts: any) => {
  const route = opts.route || '/status';
  const db = getDb();
  const { recordMessage, recordStack } = opts;

  fastify.addHook('onRoute', (routeOptions) => {
    pingRoutes([{ endpoint: routeOptions.url }]);
  });

  fastify.setErrorHandler(async (error, request, reply) => {
    await db.run('INSERT INTO errors (message, stack, endpoint) VALUES (?, ?, ?)', recordMessage ? error.message : 'API failing to respond', recordStack ? error.stack : 'No stack trace available', request.url);
    reply.send(error);
  });

  fastify.get(route, async (_request, reply) => {
    const incidents = await db.all('SELECT * FROM errors ORDER BY timestamp DESC LIMIT 10');
    const uptimeRows = await db.all('SELECT * FROM uptime ORDER BY day DESC LIMIT 2000');
    const avgUptime = uptimeRows.length ? uptimeRows.reduce((a, b) => a + b.up_seconds, 0) / uptimeRows.length : 0;
    const failedEndpoints = await db.all('SELECT endpoint FROM errors GROUP BY endpoint');
    const endpoints = [...new Set(uptimeRows.map((row: any) => row.endpoint_id))];
    console.log('Endpoints:', endpoints);
    reply.type('text/html').send(renderDashboard({ incidents, uptimeRows, avgUptime, endpoints }));
  });
});

function pingRoutes(routes: { endpoint: string }[]) {
  setInterval(async () => {
    const db = getDb();

    for (const route of routes) {
      try {
        const start = Date.now();
        console.log(`Pinging ${route.endpoint}...`);
        try {
          await axios.get(route.endpoint);
        } catch (error: any) {}
        const latency = Date.now() - start;

        const day = new Date().toISOString().slice(0, 10);
        await db.run(
          `
                    INSERT INTO uptime(day, up_seconds, latency, endpoint_id)
                    VALUES (?, 0, ?, ?)
                `,
          day,
          latency,
          route.endpoint
        );
        console.log(`Pinged ${route.endpoint} successfully in ${latency}ms`);
      } catch (error: any) {
        await db.run('INSERT INTO errors (message, stack, endpoint, type) VALUES (?, ?, ?, ?)', error.message, error.stack || 'No stack trace available', route.endpoint, 'ping');
      }
    }
  }, 15 * 6000 * 1000); // 15 minutes
}
