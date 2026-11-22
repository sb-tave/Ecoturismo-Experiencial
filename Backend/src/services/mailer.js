import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { logger, maskEmail } from '../utils/logger.js';

// Con SMTP_HOST configurado se envía por SMTP; si no, el correo se "simula" (JSON) y solo queda en el log.
const transport = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

export const outbox = []; // solo se llena en pruebas

// Mejor esfuerzo: si el correo falla, el flujo principal (por ejemplo, un pago) no se interrumpe.
export async function sendMail({ to, subject, text }) {
  try {
    await transport.sendMail({ from: config.smtp.from, to, subject, text });
    if (config.isTest) outbox.push({ to, subject, text });
    logger.info({ to: maskEmail(to), subject }, 'correo enviado');
    return true;
  } catch (err) {
    logger.error({ err, to: maskEmail(to) }, 'no se pudo enviar el correo');
    return false;
  }
}
