import pino from 'pino';
import { config } from '../config/env.js';

// RNF-09: los datos personales y credenciales nunca se escriben en los logs.
export const logger = pino({
  level: config.isTest ? 'silent' : config.logLevel,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.contrasena', '*.contrasena_hash', '*.password', '*.token'],
    censor: '[REDACTADO]',
  },
  transport: config.logPretty ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } : undefined,
});

export const maskEmail = (email = '') => {
  const [user, domain] = String(email).split('@');
  return domain ? `${user.slice(0, 2)}***@${domain}` : '***';
};
