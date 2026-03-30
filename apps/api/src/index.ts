import fastify from 'fastify';
import cors from '@fastify/cors';
import listingsRoutes from './routes/listings';
import matchRoutes from './routes/match';
import tradeRoutes from './routes/trade';

const server = fastify({ logger: true });

server.register(cors, {
  origin: true
});

// Register routes
server.register(listingsRoutes, { prefix: '/api' });
server.register(matchRoutes, { prefix: '/api' });
server.register(tradeRoutes, { prefix: '/api' });

server.get('/health', async () => {
  return { status: 'ok', protocol: 'Trion SSU API' };
});

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    console.log('API Server listening on port 3000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
