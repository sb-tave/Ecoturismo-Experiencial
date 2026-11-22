import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ quiet: true });

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const isTest = env === 'test';

const bool = (v, d = false) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));
const int = (v, d) => (v === undefined || v === '' || Number.isNaN(parseInt(v, 10)) ? d : parseInt(v, 10));
const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

export const config = {
  env,
  isProd,
  isTest,
  port: int(process.env.PORT, 3000),
  timezone: process.env.APP_TIMEZONE || 'America/Bogota',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8080')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  trustProxy: bool(process.env.TRUST_PROXY, isProd),
  forceHttps: bool(process.env.FORCE_HTTPS, isProd),

  databaseUrl: isTest
    ? process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ecoturismo_test'
    : process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ecoturismo',
  dbPoolMax: int(process.env.DB_POOL_MAX, 10),
  dbSsl: bool(process.env.DB_SSL),

  jwt: {
    secret: process.env.JWT_SECRET || 'secreto-solo-para-desarrollo-no-usar-en-produccion',
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  },
  bcryptRounds: int(process.env.BCRYPT_ROUNDS, isTest ? 4 : 12),
  rateLimit: {
    enabled: bool(process.env.RATE_LIMIT_ENABLED, !isTest),
    global: int(process.env.RATE_LIMIT_GLOBAL, 300),
    auth: int(process.env.RATE_LIMIT_AUTH, 20),
  },

  policyVersion: process.env.POLICY_VERSION || 'v1.0',
  reservationHoldMinutes: int(process.env.RESERVATION_HOLD_MINUTES, 15),
  maxStayDays: int(process.env.MAX_STAY_DAYS, 30),
  jobsEnabled: bool(process.env.JOBS_ENABLED, !isTest),
  jobsIntervalSeconds: int(process.env.JOBS_INTERVAL_SECONDS, 60),

  payments: {
    allowForcedResult: bool(process.env.PAYMENT_ALLOW_FORCED_RESULT, !isProd),
    approvalRate: num(process.env.PAYMENT_APPROVAL_RATE, 0.9),
  },

  uploads: {
    dir: path.resolve(process.env.UPLOAD_DIR || 'uploads'),
    maxMb: int(process.env.UPLOAD_MAX_MB, 5),
    maxPerService: int(process.env.MAX_PHOTOS_PER_SERVICE, 10),
  },
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || `http://localhost:${int(process.env.PORT, 3000)}`).replace(/\/$/, ''),

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: int(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Eco Turismo Experiencial <no-reply@ecoturismo.local>',
  },

  logLevel: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  logPretty: bool(process.env.LOG_PRETTY, false),
};

if (isProd && (config.jwt.secret.length < 32 || config.jwt.secret.startsWith('secreto-solo-para-desarrollo'))) {
  throw new Error('JWT_SECRET debe definirse en producción con al menos 32 caracteres');
}
