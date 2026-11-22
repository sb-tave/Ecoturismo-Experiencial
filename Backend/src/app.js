import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { pool } from './db/pool.js';
import { httpsRedirect } from './middlewares/httpsRedirect.js';
import { globalLimiter } from './middlewares/rateLimit.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { api } from './routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  // Logs sin cuerpo, sin cabeceras y sin query string (puede traer coordenadas del usuario: RNF-08/RNF-09)
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url.startsWith('/health') },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url.split('?')[0] }),
        res: (res) => ({ status: res.statusCode }),
      },
    }),
  );
  app.use(httpsRedirect);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(globalLimiter);

  // Imágenes: nombres aleatorios e inmutables, listas para cachearse en un CDN (RNF-12)
  app.use('/uploads', express.static(config.uploads.dir, { maxAge: '7d', immutable: true, index: false, dotfiles: 'deny' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: Math.round(process.uptime()) }));
  app.get('/health/ready', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'base_de_datos_no_disponible' });
    }
  });

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
