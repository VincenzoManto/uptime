"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorTrackerFastify = void 0;
exports.startErrorTracker = startErrorTracker;
exports.errorTrackerExpress = errorTrackerExpress;
const express_1 = __importDefault(require("express"));
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const db_1 = require("./db");
const frontend_1 = require("./frontend");
const axios_1 = __importDefault(require("axios"));
async function startErrorTracker() {
    console.log('Starting error tracker...');
    await (0, db_1.initDb)();
    console.log('Database initialized');
    setInterval(async () => {
        const db = (0, db_1.getDb)();
        const day = new Date().toISOString().slice(0, 10);
        await db.run(`
            INSERT INTO uptime(day, up_seconds, latency, endpoint_id)
            VALUES (?, 60, 0, 'system')
        `, day);
    }, 60000);
    // Ping routes every 1 minutes
}
// Express middleware
function errorTrackerExpress(route = '/status', opts = {}) {
    const router = express_1.default.Router();
    const routes = router.stack;
    pingRoutes(routes.map((r) => ({ endpoint: r.route.path }), opts.pingInterval));
    router.get(route, async (_req, res) => {
        const db = (0, db_1.getDb)();
        const dashboard = await callDashboard(db);
        res.type('text/html');
        res.send(dashboard);
    });
    return [
        async (err, req, _res, next) => {
            const db = (0, db_1.getDb)();
            await db.run('INSERT INTO errors (message, stack, endpoint) VALUES (?, ?, ?)', err.message, err.stack, req.originalUrl);
            next(err);
        },
        router,
    ];
}
// Fastify plugin
exports.errorTrackerFastify = (0, fastify_plugin_1.default)(async (fastify, opts) => {
    const route = opts.route || '/status';
    const db = (0, db_1.getDb)();
    const { recordMessage, recordStack } = opts;
    let pingging = {};
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
function pingRoutes(routes, interval = 15 * 6000) {
    console.log(`Pinging routes every ${interval / 1000} seconds...`);
    setInterval(async () => {
        const db = (0, db_1.getDb)();
        for (const route of routes) {
            try {
                const start = Date.now();
                console.log(`Pinging ${route.endpoint}...`);
                try {
                    await axios_1.default.get(route.endpoint);
                }
                catch (error) { }
                const latency = Date.now() - start;
                const day = new Date().toISOString().slice(0, 10);
                await db.run(`
                    INSERT INTO uptime(day, up_seconds, latency, endpoint_id)
                    VALUES (?, ${interval / 1000}, ?, ?)
                `, day, latency, route.endpoint);
                console.log(`Pinged ${route.endpoint} successfully in ${latency}ms`);
            }
            catch (error) {
                await db.run('INSERT INTO errors (message, stack, endpoint, type) VALUES (?, ?, ?, ?)', error.message, error.stack || 'No stack trace available', route.endpoint, 'ping');
            }
        }
    }, interval);
}
async function callDashboard(db) {
    const incidents = await db.all('SELECT * FROM errors ORDER BY timestamp DESC LIMIT 10');
    const uptimeRows = await db.all('SELECT * FROM uptime ORDER BY day ASC LIMIT 2000');
    const uptimePerDay = await db.all('SELECT day, SUM(up_seconds) as total_up_seconds, SUM(latency) as latency FROM uptime GROUP BY day ORDER BY day ASC LIMIT 100');
    const uptimePerDayPerEndpoint = await db.all('SELECT day, endpoint_id, SUM(up_seconds) as total_up_seconds, AVG(latency) as latency FROM uptime GROUP BY day, endpoint_id HAVING day >= date("now", "-30 days") ORDER BY day ASC');
    const endpoints = [...new Set(uptimeRows.map((row) => row.endpoint_id))];
    console.log('Endpoints:', endpoints);
    return (0, frontend_1.renderDashboard)({ incidents, uptimeRows, uptimePerDayPerEndpoint, uptimePerDay });
}
