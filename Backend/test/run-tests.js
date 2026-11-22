// Ejecuta todas las pruebas *.test.js en serie (comparten una misma base de datos de prueba).
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = new URL('.', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort().map((f) => `test/${f}`);
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    UPLOAD_DIR: join(tmpdir(), 'ecoturismo-test-uploads'),
    // Valores fijos para que las pruebas no dependan del archivo .env de cada desarrollador
    RATE_LIMIT_ENABLED: 'false',
    BCRYPT_ROUNDS: '4',
    JWT_EXPIRES_IN: '2h',
    POLICY_VERSION: 'v1.0',
    APP_TIMEZONE: 'America/Bogota',
    RESERVATION_HOLD_MINUTES: '15',
    MAX_STAY_DAYS: '30',
    MAX_PHOTOS_PER_SERVICE: '10',
    UPLOAD_MAX_MB: '5',
    PAYMENT_ALLOW_FORCED_RESULT: 'true',
    PUBLIC_BASE_URL: 'http://localhost:3000',
    CORS_ORIGINS: 'http://localhost:5173',
  },
});
process.exit(result.status ?? 1);
