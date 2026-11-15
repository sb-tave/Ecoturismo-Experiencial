import { randomUUID } from 'node:crypto';
import { config } from '../config/env.js';

// Pasarela de pagos SIMULADA (el enunciado pide un servicio simulado). No recibe ni guarda datos de tarjeta (RNF-05).
// Para demostraciones, el cliente puede forzar el resultado enviando "resultado" (PAYMENT_ALLOW_FORCED_RESULT=true);
// si no, aprueba con probabilidad PAYMENT_APPROVAL_RATE. Para integrar una pasarela real solo hay que reemplazar esta función.
export function simularPasarela({ resultado } = {}) {
  const forzado = config.payments.allowForcedResult ? resultado : undefined;
  const estado = forzado ?? (Math.random() < config.payments.approvalRate ? 'APROBADO' : 'RECHAZADO');
  return { estado, referencia: `SIM-${randomUUID().slice(0, 8).toUpperCase()}` };
}
