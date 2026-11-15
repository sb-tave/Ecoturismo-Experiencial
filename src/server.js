import { createApp } from './app.js';
import { config } from './config/env.js';
import { pool } from './db/pool.js';
import { logger } from './utils/logger.js';
import { startJobs, stopJobs } from './jobs/reservations.js';

const app = createApp();
const server = app.listen(config.port, () => logger.info(`API Eco Turismo escuchando en el puerto ${config.port} (${config.env})`));
if (config.jobsEnabled) startJobs();

// Cierre ordenado: deja de aceptar conexiones, termina las tareas y cierra el pool (alta disponibilidad, RNF-15)
function shutdown(signal) {
  logger.info({ signal }, 'cerrando el servidor');
  stopJobs();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
