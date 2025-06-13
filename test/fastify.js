const { errorTrackerFastify, startErrorTracker } = require('../dist');
const Fastify = require('fastify');

(async () => {
  await startErrorTracker();
  const app = Fastify();
  await app.register(errorTrackerFastify);
  app.get('/err', async () => {
    throw new Error('Test error');
  });
  const server = await app.listen({ port: 3050 });
})();
