import express, { Request, Response, NextFunction } from 'express';
import fastifyPlugin from 'fastify-plugin';
import { initDb, getDb } from './db';
import { renderDashboard } from './frontend';

import axios from 'axios';
import { Database, Statement } from 'sqlite';

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
export function errorTrackerExpress(route = '/status', opts: any = {}) {
  const router = express.Router();

  const routes = router.stack;

  pingRoutes(routes.map((r: any) => ({ endpoint: r.route.path }), opts.pingInterval));

  router.get(route, async (_req: Request, res: Response) => {
    const db = getDb();
    const dashboard = await callDashboard(db);
    res.type('text/html');
    res.send(dashboard);
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
  let pingging: {[key: string]: boolean} = {};

  fastify.addHook('onRoute', (routeOptions) => {
    if (routeOptions.url === route) {
      return;
    }
    if (pingging[routeOptions.url]) {
      return;
    }
    pingRoutes([{ endpoint: routeOptions.url }], opts.pingInterval);
    pingging[routeOptions.url] = true;
  });

  fastify.setErrorHandler(async (error, request, reply) => {
    await db.run('INSERT INTO errors (message, stack, endpoint) VALUES (?, ?, ?)', recordMessage ? error.message : 'API failing to respond', recordStack ? error.stack : 'No stack trace available', request.url);
    reply.send(error);
  });

  fastify.get(route, async (_request, reply) => {
    const dashboard = await callDashboard(db);
    reply.type('text/html').send(dashboard);
  });
});

function pingRoutes(routes: { endpoint: string }[], interval = 15 * 6000) {
  console.log(`Pinging routes every ${interval / 1000} seconds...`);
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
                    VALUES (?, ${interval / 1000}, ?, ?)
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
  }, interval); 
}

async function callDashboard(db: Database<any, any>) {
  const incidents = await db.all('SELECT * FROM errors ORDER BY timestamp DESC LIMIT 10');
  const uptimeRows = await db.all('SELECT * FROM uptime ORDER BY day ASC LIMIT 2000');
  const uptimePerDay = await db.all('SELECT day, SUM(up_seconds) as total_up_seconds, SUM(latency) as latency FROM uptime GROUP BY day ORDER BY day ASC LIMIT 100');
  const uptimePerDayPerEndpoint = await db.all('SELECT day, endpoint_id, SUM(up_seconds) as total_up_seconds, AVG(latency) as latency FROM uptime GROUP BY day, endpoint_id HAVING day >= date("now", "-30 days") ORDER BY day ASC');
  const endpoints = [...new Set(uptimeRows.map((row: any) => row.endpoint_id))];
  console.log('Endpoints:', endpoints);
  return renderDashboard({ incidents, uptimeRows, uptimePerDayPerEndpoint, uptimePerDay });
}
