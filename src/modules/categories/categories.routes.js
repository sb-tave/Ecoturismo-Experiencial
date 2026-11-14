import { Router } from 'express';
import { z } from '../../utils/zodEs.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, optionalAuth, requireRole } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/async.js';
import { idParam } from '../../utils/schemas.js';
import * as service from './categories.service.js';

const router = Router();
const admin = [authenticate, requireRole('ADMINISTRADOR')];

const createSchema = z.object({ nombre: z.string().trim().min(2).max(80), descripcion: z.string().trim().max(255).nullable().optional() });
const updateSchema = z
  .object({ nombre: z.string().trim().min(2).max(80), descripcion: z.string().trim().max(255).nullable(), activa: z.boolean() })
  .partial()
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'Envía al menos un campo para actualizar');
const listQuery = z.object({ todas: z.enum(['true', 'false']).optional() });

// Público: categorías activas. El administrador puede ver también las inactivas con ?todas=true
router.get('/', optionalAuth, validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const incluirInactivas = req.valid.query.todas === 'true' && req.user?.rol === 'ADMINISTRADOR';
  res.json({ data: await service.list({ incluirInactivas }) });
}));

router.post('/', ...admin, validate({ body: createSchema }), asyncHandler(async (req, res) => res.status(201).json(await service.create(req.valid.body))));

router.patch('/:id', ...admin, validate({ params: idParam, body: updateSchema }), asyncHandler(async (req, res) => {
  res.json(await service.update(req.valid.params.id, req.valid.body));
}));

router.delete('/:id', ...admin, validate({ params: idParam }), asyncHandler(async (req, res) => res.json(await service.remove(req.valid.params.id))));

export default router;
