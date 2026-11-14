import { z } from './zodEs.js';
import { isISODate } from './dates.js';

export const isoDate = z.string().refine(isISODate, 'Fecha inválida (use el formato AAAA-MM-DD)');
export const idParam = z.object({ id: z.coerce.number().int().positive() });
export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};
export const pageMeta = (page, limit, total) => ({ page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) });
export const escapeLike = (s) => String(s).replace(/[\\%_]/g, (c) => `\\${c}`);

export const password = z
  .string()
  .min(8)
  .max(72)
  .regex(/[A-Za-z]/, 'Debe incluir al menos una letra')
  .regex(/\d/, 'Debe incluir al menos un número')
  .refine((s) => Buffer.byteLength(s, 'utf8') <= 72, 'Es demasiado larga (máximo 72 bytes)');
export const phone = z.string().trim().regex(/^[0-9+()\-\s]{7,20}$/, 'Teléfono inválido');
