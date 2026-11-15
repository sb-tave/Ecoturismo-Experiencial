import { Router } from 'express';
import { z } from '../../utils/zodEs.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, optionalAuth, requireRole } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/async.js';
import { idParam, pagination } from '../../utils/schemas.js';
import * as service from './reviews.service.js';

// Se monta en /api/services/:id/reviews
const router = Router({ mergeParams: true });

const createSchema = z.object({
  id_reserva: z.coerce.number().int().positive(),
  puntuacion: z.coerce.number().int().min(1).max(5),
  comentario: z.string().trim().max(1000).nullable().optional(),
});
const listQuery = z.object(pagination);

router.get('/', optionalAuth, validate({ params: idParam, query: listQuery }), asyncHandler(async (req, res) => {
  res.json(await service.listByService(req.valid.params.id, req.valid.query, req.user));
}));

router.post('/', authenticate, requireRole('TURISTA'), validate({ params: idParam, body: createSchema }), asyncHandler(async (req, res) => {
  res.status(201).json(await service.create(req.user, req.valid.params.id, req.valid.body));
}));

export default router;
