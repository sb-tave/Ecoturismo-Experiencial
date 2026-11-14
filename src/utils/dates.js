import { config } from '../config/env.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const isISODate = (s) => typeof s === 'string' && ISO.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

// Fecha de hoy (AAAA-MM-DD) en la zona horaria de la aplicación.
export const todayISO = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const diffDays = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);

export const eachDay = (from, to) => {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};
