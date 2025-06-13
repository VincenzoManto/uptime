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
function errorTrackerExpress(route = '/status') {
    const router = express_1.default.Router();
    const routes = router.stack;
    pingRoutes(routes.map((r) => ({ endpoint: r.route.path })));
    router.get(route, async (_req, res) => {
        const db = (0, db_1.getDb)();
        const incidents = await db.all('SELECT * FROM errors ORDER BY timestamp DESC LIMIT 10');
        const uptimeRows = await db.all('SELECT * FROM uptime ORDER BY day DESC LIMIT 2000');
        const avgUptime = uptimeRows.length ? uptimeRows.reduce((a, b) => a + b.up_seconds, 0) / uptimeRows.length : 0;
        const endpoints = router.stack
            .filter((r) => r.route && r.route.path && r.route.methods.get)
            .map((r) => r.route.path)
            .filter((path) => path !== route);
        res.send((0, frontend_1.renderDashboard)({ incidents, uptimeRows, avgUptime, endpoints }));
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
        const endpoints = failedEndpoints.map((row) => row.endpoint).filter((ep) => ep !== route);
        console.log('Endpoints:', endpoints);
        reply.type('text/html').send((0, frontend_1.renderDashboard)({ incidents, uptimeRows, avgUptime, endpoints }));
    });
});
function pingRoutes(routes) {
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
                    VALUES (?, 0, ?, ?)
                `, day, latency, route.endpoint);
                console.log(`Pinged ${route.endpoint} successfully in ${latency}ms`);
            }
            catch (error) {
                await db.run('INSERT INTO errors (message, stack, endpoint, type) VALUES (?, ?, ?, ?)', error.message, error.stack || 'No stack trace available', route.endpoint, 'ping');
            }
        }
    }, 6000 * 1000); // 15 minutes
}
